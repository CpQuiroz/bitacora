import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, PaqueteSesionesConSaldo, Prioridad, TipoPack, Usuario } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Card, Input, LoadingScreen, PickerBuscable, SelectorHora, Text } from "../../components/ui";
import { SelectorCliente } from "../../components/SelectorCliente";
import { SelectorResponsable } from "../../components/SelectorResponsable";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { catalogoParaCita, crearCita, editarCita, obtenerTarea, type BorradorCita } from "../../services/agenda";
import { crearPaquete, listarPaquetesCliente } from "../../services/paquetes";
import { listarTiposPack } from "../../services/tiposPack";
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

export function NuevaCitaScreen({ navigation, route }: NativeStackScreenProps<AgendaStackParamList, "NuevaCita">) {
  const t = useTema();
  const { enLinea } = useRed();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const agendaPro = auth.fase === "listo" && auth.modulosVisibles.includes("agenda_pro");

  const editandoId = route.params?.tareaId ?? null;
  const fechaInicial = route.params?.fecha ?? clave(new Date());

  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [cargandoCita, setCargandoCita] = useState(Boolean(editandoId));
  const [guardando, setGuardando] = useState(false);

  const [paquetes, setPaquetes] = useState<PaqueteSesionesConSaldo[]>([]);
  const [tiposPack, setTiposPack] = useState<TipoPack[]>([]);
  const [nuevoPaqueteAbierto, setNuevoPaqueteAbierto] = useState(false);
  const [tipoPackId, setTipoPackId] = useState("");
  const [nombrePaquete, setNombrePaquete] = useState("");
  const [cantidadPaquete, setCantidadPaquete] = useState("10");
  const [creandoPaquete, setCreandoPaquete] = useState(false);

  const [b, setB] = useState<BorradorCita>({
    titulo: "",
    fecha: fechaInicial,
    hora: "",
    duracion_min: "",
    cliente_id: "",
    responsable_id: "",
    descripcion: "",
    prioridad: "media",
    paquete_id: "",
    sesiones_consumidas: 1,
  });
  const set = <K extends keyof BorradorCita>(k: K, v: BorradorCita[K]) => setB((p) => ({ ...p, [k]: v }));

  // Rango de fechas de los chips: desde hoy (o desde la fecha actual de
  // la cita si está en el pasado, para poder mantenerla).
  const dias = useMemo(() => {
    const hoy = new Date();
    const base = b.fecha < clave(hoy) ? new Date(b.fecha + "T00:00:00") : hoy;
    return Array.from({ length: 45 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [b.fecha]);

  useEffect(() => {
    navigation.setOptions({ title: editandoId ? "Editar cita" : "Nueva cita" });
  }, [navigation, editandoId]);

  useEffect(() => {
    catalogoParaCita().then(({ clientes, equipo }) => {
      setClientes(clientes.filter((c) => c.activo));
      setEquipo(equipo);
    });
  }, []);

  useEffect(() => {
    if (!agendaPro) return;
    listarTiposPack().then(setTiposPack);
  }, [agendaPro]);

  // Carga los paquetes del cliente elegido (Agenda Pro).
  useEffect(() => {
    if (!agendaPro || !b.cliente_id) {
      setPaquetes([]);
      return;
    }
    let vivo = true;
    listarPaquetesCliente(b.cliente_id).then((ps) => {
      if (vivo) setPaquetes(ps);
    });
    return () => {
      vivo = false;
    };
  }, [agendaPro, b.cliente_id]);

  useEffect(() => {
    if (!editandoId) return;
    obtenerTarea(editandoId)
      .then(({ tarea }) => {
        setB({
          titulo: tarea.titulo,
          fecha: tarea.fecha,
          hora: tarea.hora ? tarea.hora.slice(0, 5) : "",
          duracion_min: tarea.duracion_min ? String(tarea.duracion_min) : "",
          cliente_id: tarea.cliente_id ?? "",
          responsable_id: tarea.responsable_id ?? "",
          descripcion: tarea.descripcion ?? "",
          paquete_id: tarea.paquete_id ?? "",
          sesiones_consumidas: tarea.sesiones_consumidas ?? 1,
          prioridad: tarea.prioridad,
        });
      })
      .catch((e) => Alert.alert("No se pudo cargar la cita", e instanceof Error ? e.message : "Intenta de nuevo"))
      .finally(() => setCargandoCita(false));
  }, [editandoId]);

  async function guardar() {
    if (!b.titulo.trim()) return Alert.alert("Falta el título", "Escribe de qué se trata la cita.");
    if (b.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.hora)) {
      return Alert.alert("Hora inválida", "Usa el formato HH:MM (ej. 09:30).");
    }
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para guardar la cita.");

    setGuardando(true);
    const r = editandoId ? await editarCita(editandoId, b) : await crearCita(b);
    setGuardando(false);
    if (!r.ok) {
      Alert.alert("No se pudo guardar", r.error);
      return;
    }
    Alert.alert(editandoId ? "Cita actualizada" : "Cita agendada", "Listo.", [
      { text: "Listo", onPress: () => navigation.goBack() },
    ]);
  }

  if (clientes === null || cargandoCita) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(8) }}
        keyboardShouldPersistTaps="handled"
      >
      <Input etiqueta="Título" placeholder="Ej. Manicure + esmaltado" value={b.titulo} onChangeText={(v) => set("titulo", v)} />

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

      <SelectorHora etiqueta="Hora (opcional)" valor={b.hora} onCambiar={(v) => set("hora", v)} />

      {b.hora ? (
        <Input
          etiqueta="Duración en minutos (opcional)"
          placeholder="Ej. 60"
          keyboardType="numeric"
          value={b.duracion_min}
          onChangeText={(v) => set("duracion_min", v.replace(/\D/g, ""))}
        />
      ) : null}

      <SelectorCliente
        etiqueta="Cliente (opcional)"
        valor={b.cliente_id}
        onElegir={(id) => set("cliente_id", id)}
        clientes={clientes}
        onClienteCreado={(c) => setClientes((prev) => [...(prev ?? []), c])}
      />

      {agendaPro && b.cliente_id ? (
        <Card plano style={{ gap: t.espacio(3) }}>
          <Text variante="etiqueta" weight="semibold">
            Paquete de sesiones (Agenda Pro)
          </Text>
          <PickerBuscable
            etiqueta="Paquete"
            placeholder="Sin paquete — cita suelta"
            opcionVacia="Sin paquete — cita suelta"
            valor={b.paquete_id}
            opciones={paquetes.map((p) => ({
              id: p.id,
              label: p.nombre,
              sublabel: `${p.saldo}/${p.cantidad_total} sesiones disponibles`,
            }))}
            onElegir={(id) => set("paquete_id", id)}
          />
          {b.paquete_id ? (
            <Input
              etiqueta="Sesiones que descuenta esta cita"
              keyboardType="numeric"
              value={String(b.sesiones_consumidas)}
              onChangeText={(v) => set("sesiones_consumidas", Math.max(1, Number(v.replace(/\D/g, "")) || 1))}
            />
          ) : null}

          {nuevoPaqueteAbierto ? (
            <View style={{ gap: t.espacio(2.5), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(3) }}>
              {tiposPack.length > 0 ? (
                <PickerBuscable
                  etiqueta="Tipo de pack (opcional)"
                  placeholder="Personalizado"
                  opcionVacia="Personalizado — completar a mano"
                  valor={tipoPackId}
                  opciones={tiposPack.map((tp) => ({ id: tp.id, label: tp.nombre, sublabel: `${tp.cantidad_sesiones} sesiones` }))}
                  onElegir={(id) => {
                    setTipoPackId(id);
                    const tipo = tiposPack.find((tp) => tp.id === id);
                    if (tipo) {
                      setNombrePaquete(tipo.nombre);
                      setCantidadPaquete(String(tipo.cantidad_sesiones));
                    }
                  }}
                />
              ) : null}
              <Input etiqueta="Nombre del paquete" placeholder="Ej. Pack 10 sesiones" value={nombrePaquete} onChangeText={setNombrePaquete} />
              <Input etiqueta="Cantidad de sesiones" keyboardType="numeric" value={cantidadPaquete} onChangeText={(v) => setCantidadPaquete(v.replace(/\D/g, ""))} />
              <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
                <Button
                  titulo="Crear paquete"
                  cargando={creandoPaquete}
                  onPress={async () => {
                    const cant = Number(cantidadPaquete) || 0;
                    if (!nombrePaquete.trim() || cant <= 0) {
                      Alert.alert("Faltan datos", "Ponle un nombre y una cantidad de sesiones.");
                      return;
                    }
                    setCreandoPaquete(true);
                    const r = await crearPaquete({
                      cliente_id: b.cliente_id,
                      tipo_pack_id: tipoPackId || undefined,
                      nombre: nombrePaquete,
                      cantidad_total: cant,
                    });
                    setCreandoPaquete(false);
                    if (!r.ok) {
                      Alert.alert("No se pudo crear el paquete", r.error);
                      return;
                    }
                    const ps = await listarPaquetesCliente(b.cliente_id);
                    setPaquetes(ps);
                    setB((p) => ({ ...p, paquete_id: r.paquete.id }));
                    setNuevoPaqueteAbierto(false);
                    setTipoPackId("");
                    setNombrePaquete("");
                    setCantidadPaquete("10");
                  }}
                />
                <Button
                  titulo="Cancelar"
                  variante="ghost"
                  onPress={() => {
                    setNuevoPaqueteAbierto(false);
                    setTipoPackId("");
                  }}
                />
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setNuevoPaqueteAbierto(true)} hitSlop={6}>
              <Text variante="caption" weight="semibold" tono="brand">
                ＋ Crear paquete nuevo para este cliente
              </Text>
            </Pressable>
          )}
        </Card>
      ) : null}

      {esGestion ? (
        <SelectorResponsable
          etiqueta="Atiende (opcional)"
          valor={b.responsable_id}
          onElegir={(id) => set("responsable_id", id)}
          equipo={equipo}
          opcionVacia="Sin asignar"
          permitirInvitar={auth.fase === "listo" && auth.modulosVisibles.includes("gestion_control")}
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
        <Button
          titulo={editandoId ? "Guardar cambios" : "Agendar cita"}
          tamano="lg"
          onPress={guardar}
          cargando={guardando}
        />
      </View>
    </View>
  );
}
