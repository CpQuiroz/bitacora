import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PeriodoRendicion } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, SelectorDias, Texto, useMarca } from "@bitacora/ui/native";
import { InputMonto } from "../../components/InputMonto";
import { crearRendicion, type BorradorRendicion } from "../../services/rendiciones";
import type { MasStackParamList } from "../../shell/navigation/types";

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PERIODOS: { valor: PeriodoRendicion; label: string }[] = [
  { valor: "diario", label: "Diario" },
  { valor: "semanal", label: "Semanal" },
];

const VACIO: BorradorRendicion = {
  periodo: "semanal",
  fecha_inicio: clave(new Date()),
  fecha_termino: clave(new Date()),
  monto_entregado: "",
};

// "Nueva rendición" (Más → Rendiciones → +, 21-sep-2026) — registra el
// fondo por rendir que le entregaron al colaborador; los gastos se van
// agregando después desde el detalle (RendicionDetalleScreen), que
// reusa el formulario de Nuevo Gasto.
export function RendicionFormScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "RendicionForm">) {
  const insets = useSafeAreaInsets();
  const [b, setB] = useState<BorradorRendicion>(VACIO);
  const set = <K extends keyof BorradorRendicion>(k: K, v: BorradorRendicion[K]) => setB((p) => ({ ...p, [k]: v }));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: "Nueva rendición" });
  }, [navigation]);

  async function guardar() {
    if (!(Number(b.monto_entregado || 0) > 0)) return Alert.alert("Falta el monto", "Ingresa cuánto se te entregó.");
    if (b.fecha_termino < b.fecha_inicio) return Alert.alert("Fechas inválidas", "La fecha de término no puede ser antes que la de inicio.");

    setGuardando(true);
    const r = await crearRendicion(b);
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo crear la rendición", r.error);
    navigation.replace("RendicionDetalle", { id: r.rendicion.id });
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: tokens.space["1"] * 1.5 }}>
          <Texto tamano={tokens.size.small} peso="medium" color={`${tokens.color.text}99`}>
            Período
          </Texto>
          <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
            {PERIODOS.map((p) => (
              <PeriodoChip key={p.valor} activo={p.valor === b.periodo} label={p.label} onPress={() => set("periodo", p.valor)} />
            ))}
          </View>
        </View>

        <View style={{ gap: tokens.space["1"] * 1.5 }}>
          <Texto tamano={tokens.size.small} peso="medium" color={`${tokens.color.text}99`}>
            Desde
          </Texto>
          <SelectorDias valor={b.fecha_inicio} onElegir={(k) => set("fecha_inicio", k)} />
        </View>

        <View style={{ gap: tokens.space["1"] * 1.5 }}>
          <Texto tamano={tokens.size.small} peso="medium" color={`${tokens.color.text}99`}>
            Hasta
          </Texto>
          <SelectorDias valor={b.fecha_termino} onElegir={(k) => set("fecha_termino", k)} />
        </View>

        <View style={{ gap: tokens.space["1"] * 1.5 }}>
          <Texto tamano={tokens.size.small} peso="medium" color={`${tokens.color.text}99`}>
            Monto entregado
          </Texto>
          <InputMonto valor={b.monto_entregado} onChangeText={(v) => set("monto_entregado", v)} />
        </View>
      </ScrollView>

      <View style={{ padding: tokens.space["4"], borderTopWidth: 1, borderTopColor: tokens.color.divider, backgroundColor: tokens.color.surface }}>
        <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
          Crear rendición
        </Button>
      </View>
    </View>
  );
}

function PeriodoChip({ activo, label, onPress }: { activo: boolean; label: string; onPress: () => void }) {
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
        backgroundColor: activo ? marca.suave : tokens.color.surface,
        borderWidth: 1,
        borderColor: activo ? marca.base : tokens.color.divider,
      }}
    >
      <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : `${tokens.color.text}99`}>
        {label}
      </Texto>
    </Pressable>
  );
}
