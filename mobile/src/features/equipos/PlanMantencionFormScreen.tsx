import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { X } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, DatePicker, ErrorState, Input, LoadingState, ScreenHeader, Textarea } from "@bitacora/ui/native";
import type { MasStackParamList } from "../../shell/navigation/types";
import { guardarPlan, planesDeEquipo } from "../../services/equipos";
import { aFecha, aIso } from "./fechas";

// Tarea 146: crear o editar el plan de mantención preventiva de un equipo
// (frecuencia en días + próxima fecha), igual que en la web.
export function PlanMantencionFormScreen({ navigation, route }: NativeStackScreenProps<MasStackParamList, "PlanMantencionForm">) {
  const { equipoId, planId } = route.params;
  const [cargado, setCargado] = useState(!planId);
  const [error, setError] = useState<string | null>(null);
  const [frecuencia, setFrecuencia] = useState("180");
  const [proxima, setProxima] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!planId) return;
    planesDeEquipo(equipoId).then((planes) => {
      const p = planes.find((x) => x.id === planId);
      if (!p) {
        setError("No se encontró el plan");
        return;
      }
      setFrecuencia(String(p.frecuencia_dias));
      setProxima(p.proxima_fecha);
      setNotas(p.notas ?? "");
      setCargado(true);
    });
  }, [equipoId, planId]);

  const titulo = planId ? "Editar plan" : "Nuevo plan de mantención";
  const cerrar = { icono: <X size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Cerrar" };

  if (!cargado) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={titulo} accion={cerrar} />
        {error ? <ErrorState mensaje={error} /> : <LoadingState />}
      </View>
    );
  }

  async function guardar() {
    const dias = Number(frecuencia);
    if (!Number.isInteger(dias) || dias <= 0 || dias > 3650) return Alert.alert("Frecuencia inválida", "Escribe cada cuántos días (entre 1 y 3650).");
    if (!proxima) return Alert.alert("Falta la fecha", "Elige la próxima fecha de mantención.");
    setGuardando(true);
    const r = await guardarPlan(equipoId, { frecuencia_dias: dias, proxima_fecha: proxima, notas: notas.trim() }, planId);
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
    navigation.goBack();
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo={titulo} accion={cerrar} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["3"] }} keyboardShouldPersistTaps="handled">
          <Input etiqueta="Frecuencia (días)" tipo="numero" valor={frecuencia} onCambio={(v) => setFrecuencia(v.replace(/\D/g, "").slice(0, 4))} />
          <DatePicker etiqueta="Próxima fecha" valor={aFecha(proxima)} onCambio={(f) => setProxima(aIso(f))} />
          <Textarea etiqueta="Notas (opcional)" valor={notas} onCambio={setNotas} filas={3} />
          <Button bloque cargando={guardando} onPress={() => void guardar()}>
            {planId ? "Guardar cambios" : "Crear plan"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
