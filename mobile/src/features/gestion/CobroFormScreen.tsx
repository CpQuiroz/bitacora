import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, MedioPago } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, LoadingState, Texto, useMarca } from "@bitacora/ui/native";
import { InputMonto } from "../../components/InputMonto";
import { SelectorCliente } from "../../components/SelectorCliente";
import { useRed } from "../../services/sync/NetworkProvider";
import { listarClientes } from "../../services/clientes";
import { crearCobro, type BorradorCobro } from "../../services/cobros";
import type { MasStackParamList } from "../../shell/navigation/types";

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

// Sistema visual móvil v2 — pantalla MODAL: el header nativo del Stack
// ya queda bien con tokens (se resuelve a nivel de navigator), así que
// acá solo se recolorea el contenido. Sin ScreenHeader propio.
export function CobroFormScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "CobroForm">) {
  const marca = useMarca();
  // Pantalla modal (presentation: "modal" en MasStack.tsx) — no vive
  // dentro del pager de AppTabs.tsx, así que no hereda el fix de
  // paddingBottom de la tab bar (ver ese archivo, 20-sep-2026). Necesita
  // su propio insets.bottom para no quedar detrás de la barra de
  // gestos/navegación de Android.
  const insets = useSafeAreaInsets();
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

  if (clientes === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  const vencDiasActual = Math.round((new Date(b.fecha_vencimiento).getTime() - new Date(b.fecha_emision).getTime()) / 86400000);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <SelectorCliente
          valor={b.cliente_id}
          onElegir={(id) => set("cliente_id", id)}
          clientes={clientes}
          onClienteCreado={(c) => setClientes((prev) => [...(prev ?? []), c])}
        />

        <InputMonto valor={b.monto} onChangeText={(v) => set("monto", v)} />

        <View style={{ gap: tokens.space["1"] }}>
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            Vence en
          </Texto>
          <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
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
                    borderRadius: tokens.radius.md,
                    backgroundColor: activo ? marca.suave : tokens.color.surface,
                    borderWidth: 1,
                    borderColor: activo ? marca.base : tokens.color.divider,
                  }}
                >
                  <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : tokens.color.textSecondary}>
                    {o.label}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
          <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
            Vence el {fechaLarga(b.fecha_vencimiento)}
          </Texto>
        </View>

        <View style={{ gap: tokens.space["1"] }}>
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            Medio de pago previsto (opcional)
          </Texto>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
            {MEDIOS.map((m) => {
              const activo = b.medio_pago === m.v;
              return (
                <Pressable
                  key={m.label}
                  onPress={() => set("medio_pago", m.v)}
                  style={{
                    minHeight: 40,
                    justifyContent: "center",
                    paddingHorizontal: tokens.space["3"],
                    borderRadius: tokens.radius.md,
                    backgroundColor: activo ? marca.suave : tokens.color.surface,
                  }}
                >
                  <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : tokens.color.textSecondary}>
                    {m.label}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          padding: tokens.space["4"],
          paddingBottom: tokens.space["6"],
          borderTopWidth: 1,
          borderTopColor: tokens.color.divider,
          backgroundColor: tokens.color.surface,
        }}
      >
        <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
          Crear cobro
        </Button>
      </View>
    </View>
  );
}
