import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, Prioridad, Usuario } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Input, LoadingScreen, PickerBuscable, Text } from "../../components/ui";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { catalogoParaCita, crearCita, type BorradorCita } from "../../services/agenda";
import type { AgendaStackParamList } from "../../shell/navigation/types";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIORIDADES: { valor: Prioridad; label: string }[] = [
  { valor: "baja", label: "Baja" },
  { valor: "media", label: "Media" },
  { valor: "alta", label: "Alta" },
];

export function NuevaCitaScreen({ navigation }: NativeStackScreenProps<AgendaStackParamList, "NuevaCita">) {
  const t = useTema();
  const { enLinea } = useRed();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [guardando, setGuardando] = useState(false);

  const hoy = useMemo(() => new Date(), []);
  const dias = useMemo(
    () => Array.from({ length: 30 }, (_, i) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i)),
    [hoy]
  );

  const [b, setB] = useState<BorradorCita>({
    titulo: "",
    fecha: clave(hoy),
    hora: "",
    cliente_id: "",
    responsable_id: "",
    descripcion: "",
    prioridad: "media",
  });
  const set = <K extends keyof BorradorCita>(k: K, v: BorradorCita[K]) => setB((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    catalogoParaCita().then(({ clientes, equipo }) => {
      setClientes(clientes.filter((c) => c.activo));
      setEquipo(equipo);
    });
  }, []);

  async function guardar() {
    if (!b.titulo.trim()) return Alert.alert("Falta el título", "Escribe de qué se trata la cita.");
    if (b.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.hora)) {
      return Alert.alert("Hora inválida", "Usa el formato HH:MM (ej. 09:30).");
    }
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para agendar una cita.");

    setGuardando(true);
    const r = await crearCita(b);
    setGuardando(false);
    if (!r.ok) {
      Alert.alert("No se pudo agendar", r.error);
      return;
    }
    Alert.alert("Cita agendada", "Quedó en la agenda.", [{ text: "Listo", onPress: () => navigation.goBack() }]);
  }

  if (clientes === null) return <LoadingScreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colores.bg }}
      contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(12) }}
      keyboardShouldPersistTaps="handled"
    >
      <Input etiqueta="Título" placeholder="Ej. Visita de seguimiento" value={b.titulo} onChangeText={(v) => set("titulo", v)} />

      <View style={{ gap: t.espacio(1.5) }}>
        <Text variante="etiqueta" tono="muted">
          Fecha
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.espacio(2) }}>
          {dias.map((d) => {
            const k = clave(d);
            const activo = k === b.fecha;
            return (
              <Pressable
                key={k}
                onPress={() => set("fecha", k)}
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
                <Text variante="caption" tono={activo ? "inverso" : "faint"}>
                  {MESES[d.getMonth()]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Input
        etiqueta="Hora (opcional)"
        placeholder="HH:MM"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        value={b.hora}
        onChangeText={(v) => set("hora", v)}
      />

      <PickerBuscable
        etiqueta="Cliente (opcional)"
        placeholder="Elegir cliente"
        valor={b.cliente_id}
        opcionVacia="Sin cliente"
        opciones={clientes.map((c) => ({ id: c.id, label: c.nombre }))}
        onElegir={(id) => set("cliente_id", id)}
      />

      {esGestion && equipo.length > 0 ? (
        <PickerBuscable
          etiqueta="Asignar a (opcional)"
          placeholder="Elegir responsable"
          valor={b.responsable_id}
          opcionVacia="Sin asignar"
          opciones={equipo.map((u) => ({ id: u.id, label: u.nombre }))}
          onElegir={(id) => set("responsable_id", id)}
        />
      ) : null}

      <View style={{ gap: t.espacio(1.5) }}>
        <Text variante="etiqueta" tono="muted">
          Prioridad
        </Text>
        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
          {PRIORIDADES.map((p) => {
            const activo = b.prioridad === p.valor;
            return (
              <Pressable
                key={p.valor}
                onPress={() => set("prioridad", p.valor)}
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
                <Text variante="etiqueta" weight="semibold" tono={activo ? "inverso" : "muted"}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Input
        etiqueta="Notas (opcional)"
        placeholder="Detalle de la cita"
        multiline
        value={b.descripcion}
        onChangeText={(v) => set("descripcion", v)}
      />

      <Button titulo="Agendar cita" tamano="lg" onPress={guardar} cargando={guardando} style={{ marginTop: t.espacio(2) }} />
    </ScrollView>
  );
}
