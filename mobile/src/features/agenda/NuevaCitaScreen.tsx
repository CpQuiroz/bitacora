import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, PaqueteSesionesConSaldo, Prioridad, TipoPack, Usuario } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, LoadingState, SelectorDias, Textarea, Texto, useMarca, useToast } from "@bitacora/ui/native";
import { PickerBuscable, SelectorHora } from "../../components/ui";
import { SelectorCliente } from "../../components/SelectorCliente";
import { SelectorResponsable } from "../../components/SelectorResponsable";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { catalogoParaCita, crearCita, editarCita, obtenerTarea, type BorradorCita } from "../../services/agenda";
import { crearPaquete, listarPaquetesCliente } from "../../services/paquetes";
import { listarTiposPack } from "../../services/tiposPack";
import type { AgendaStackParamList } from "../../shell/navigation/types";
import { NuevaReservaCosmetologia } from "./NuevaReservaCosmetologia";

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIORIDADES: { valor: Prioridad; label: string }[] = [
  { valor: "baja", label: "Baja" },
  { valor: "media", label: "Media" },
  { valor: "alta", label: "Alta" },
];

// Tema por rubro: cosmetología tiene su propia pantalla de creación
// ("Nueva reserva") — solo para crear, editar sigue con el genérico. La
// elección vive en este envoltorio y no dentro de NuevaCitaGenerica:
// un return anticipado antes de sus hooks rompe las reglas de React.
export function NuevaCitaScreen(props: NativeStackScreenProps<AgendaStackParamList, "NuevaCita">) {
  const auth = useAuth();
  const editandoId = props.route.params?.tareaId ?? null;
  if (!editandoId && auth.fase === "listo" && auth.usuario.empresa.rubro === "cosmetologia") {
    return <NuevaReservaCosmetologia navigation={props.navigation} route={props.route} />;
  }
  return <NuevaCitaGenerica {...props} />;
}

function NuevaCitaGenerica({ navigation, route }: NativeStackScreenProps<AgendaStackParamList, "NuevaCita">) {
  const marca = useMarca();
  const toast = useToast();
  // Pantalla modal (presentation: "modal" en AgendaStack.tsx) — no vive
  // dentro del pager de AppTabs.tsx, así que no hereda el fix de
  // paddingBottom de la tab bar (ver ese archivo, 20-sep-2026). Necesita
  // su propio insets.bottom para no quedar detrás de la barra de
  // gestos/navegación de Android.
  const insets = useSafeAreaInsets();
  const { enLinea } = useRed();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const agendaPro = auth.fase === "listo" && auth.modulosVisibles.includes("agenda_pro");

  const editandoId = route.params?.tareaId ?? null;
  const fechaInicial = route.params?.fecha ?? clave(new Date());
  // Ya no se pide "duración en minutos" en el formulario (19-sep-2026) —
  // toda cita nueva con hora usa este valor de empresa en silencio
  // (Configuración > Empresa > Agenda). Al editar se respeta la
  // duración que la cita ya tenía (obtenerTarea la carga tal cual).
  const duracionDefault = auth.fase === "listo" ? auth.usuario.empresa.duracion_cita_default_min ?? 60 : 60;

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
      .catch((e) => toast(`No se pudo cargar la cita: ${e instanceof Error ? e.message : "intenta de nuevo"}`, { tono: "error" }))
      .finally(() => setCargandoCita(false));
  }, [editandoId]);

  async function guardar() {
    if (!b.titulo.trim()) return toast("Falta el título: escribe de qué se trata la cita.", { tono: "error" });
    if (b.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.hora)) {
      return toast("Hora inválida: usa el formato HH:MM (ej. 09:30).", { tono: "error" });
    }
    if (!enLinea) return toast("Sin conexión: necesitas conexión para guardar la cita.", { tono: "error" });

    // Al crear (no al editar): si hay hora y no hay duración cargada
    // (ya no se pide a mano), se usa el default de empresa.
    const payload: BorradorCita =
      !editandoId && b.hora && !b.duracion_min ? { ...b, duracion_min: String(duracionDefault) } : b;

    setGuardando(true);
    const r = editandoId ? await editarCita(editandoId, payload) : await crearCita(payload);
    setGuardando(false);
    if (!r.ok) {
      toast(`No se pudo guardar: ${r.error}`, { tono: "error" });
      return;
    }
    toast(editandoId ? "Cita actualizada" : "Cita agendada", { tono: "exito" });
    navigation.goBack();
  }

  if (clientes === null || cargandoCita) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <Input etiqueta="Título" placeholder="Ej. Manicure + esmaltado" valor={b.titulo} onCambio={(v) => set("titulo", v)} />

          <View style={{ gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              Fecha
            </Texto>
            <SelectorDias valor={b.fecha} onElegir={(k) => set("fecha", k)} diasAtras={0} />
          </View>

          <SelectorHora etiqueta="Hora (opcional)" valor={b.hora} onCambiar={(v) => set("hora", v)} />

          <SelectorCliente
            etiqueta="Cliente (opcional)"
            valor={b.cliente_id}
            onElegir={(id) => set("cliente_id", id)}
            clientes={clientes}
            onClienteCreado={(c) => setClientes((prev) => [...(prev ?? []), c])}
          />

          {agendaPro && b.cliente_id ? (
            <View style={{ backgroundColor: tokens.color.surface, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.color.divider, padding: tokens.space["4"], gap: tokens.space["3"] }}>
              <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text}>
                Paquete de sesiones (Agenda Pro)
              </Texto>
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
                  tipo="numero"
                  valor={String(b.sesiones_consumidas)}
                  onCambio={(v) => set("sesiones_consumidas", Math.max(1, Number(v.replace(/\D/g, "")) || 1))}
                />
              ) : null}

              {nuevoPaqueteAbierto ? (
                <View style={{ gap: tokens.space["2"], borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["3"] }}>
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
                  <Input etiqueta="Nombre del paquete" placeholder="Ej. Pack 10 sesiones" valor={nombrePaquete} onCambio={setNombrePaquete} />
                  <Input etiqueta="Cantidad de sesiones" tipo="numero" valor={cantidadPaquete} onCambio={(v) => setCantidadPaquete(v.replace(/\D/g, ""))} />
                  <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
                    <Button
                      cargando={creandoPaquete}
                      onPress={async () => {
                        const cant = Number(cantidadPaquete) || 0;
                        if (!nombrePaquete.trim() || cant <= 0) {
                          toast("Faltan datos: ponle un nombre y una cantidad de sesiones.", { tono: "error" });
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
                          toast(`No se pudo crear el paquete: ${r.error}`, { tono: "error" });
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
                    >
                      Crear paquete
                    </Button>
                    <Button
                      variante="ghost"
                      onPress={() => {
                        setNuevoPaqueteAbierto(false);
                        setTipoPackId("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setNuevoPaqueteAbierto(true)} hitSlop={6}>
                  <Texto tamano={tokens.size.caption} peso="semibold" color={marca.base}>
                    ＋ Crear paquete nuevo para este cliente
                  </Texto>
                </Pressable>
              )}
            </View>
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

          <View style={{ gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              Prioridad
            </Texto>
            <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
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
                      borderRadius: tokens.radius.md,
                      backgroundColor: activo ? marca.suave : tokens.color.surface,
                      borderWidth: 1,
                      borderColor: activo ? marca.base : tokens.color.divider,
                    }}
                  >
                    <Texto tamano={tokens.size.small} peso="semibold" color={activo ? marca.fuerte : tokens.color.textSecondary}>
                      {p.label}
                    </Texto>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Textarea
            etiqueta="Notas (opcional)"
            placeholder="Detalle de la cita"
            valor={b.descripcion}
            onCambio={(v) => set("descripcion", v)}
          />
        </ScrollView>
      </KeyboardAvoidingView>

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
          {editandoId ? "Guardar cambios" : "Agendar cita"}
        </Button>
      </View>
    </View>
  );
}
