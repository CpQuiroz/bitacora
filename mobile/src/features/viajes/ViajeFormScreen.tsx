import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, Check, Square } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CIUDADES_CHILE, ROLES_SUPERVISION, type Cliente, type Equipo, type Usuario } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, DatePicker, Input, LoadingState, ScreenHeader, Skeleton, Texto, useMarca } from "@bitacora/ui/native";
import { PickerBuscable } from "../../components/ui";
import { SelectorCliente } from "../../components/SelectorCliente";
import { InputMonto } from "../../components/InputMonto";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { elegirFotos } from "../../lib/imagen";
import {
  catalogoParaViaje,
  crearViaje,
  listarChoferes,
  editarViaje,
  encolarViaje,
  obtenerViaje,
  type BorradorViaje,
} from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

const VACIO: BorradorViaje = {
  cliente_id: "",
  numero_guia: "",
  origen: "",
  destino: "",
  equipo_id: "",
  km_inicial: "",
  km_final: "",
  subtotal: "",
  aplica_iva: true,
};

// Sistema visual móvil v2 (14-sep-2026) — ScreenHeader propio (volver) +
// tokens/Texto/Button en vez de useTema()/components-ui viejo. Se
// mantienen SelectorCliente/PickerBuscable/InputMonto tal cual (sin
// equivalente v2, mismo criterio que NuevaCitaScreen/CobroFormScreen).
export function ViajeFormScreen({ navigation, route }: NativeStackScreenProps<ViajesStackParamList, "ViajeForm">) {
  const marca = useMarca();
  const { enLinea } = useRed();
  const editandoId = route.params?.viajeId ?? null;
  // Tarea 132: al EDITAR, el monto solo lo cambian Admin y Supervisor (el
  // backend lo exige igual). Al crear, el chofer sigue ingresándolo.
  const auth = useAuth();
  const puedeEditarMonto = !editandoId || (auth.fase === "listo" && ROLES_SUPERVISION.includes(auth.usuario.rol));
  // Tarea 133: al CREAR, Admin/Supervisor pueden asignarlo a un chofer,
  // con fecha y hora; sin chofer se registra como propio (como siempre).
  const puedeAsignar = !editandoId && auth.fase === "listo" && ROLES_SUPERVISION.includes(auth.usuario.rol);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [fechaViaje, setFechaViaje] = useState<Date>(() => new Date());
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [b, setB] = useState<BorradorViaje>(VACIO);
  const [foto, setFoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargandoViaje, setCargandoViaje] = useState(Boolean(editandoId));

  useEffect(() => {
    catalogoParaViaje().then(({ clientes, equipos }) => {
      setClientes(clientes.filter((c) => c.activo));
      setEquipos(equipos.filter((e) => e.activo));
    });
  }, []);

  useEffect(() => {
    if (puedeAsignar) void listarChoferes().then(setChoferes);
  }, [puedeAsignar]);

  // Viático del chofer (tarea 137): se ve acá, lo asigna la oficina en la web.
  const [viatico, setViatico] = useState<{ tipo: string; monto: number } | null>(null);

  useEffect(() => {
    if (!editandoId) return;
    obtenerViaje(editandoId)
      .then(({ viaje }) => {
        setViatico(viaje.viatico_tipo ? { tipo: viaje.viatico_tipo, monto: Number(viaje.viatico_monto ?? 0) } : null);
        setB({
          cliente_id: viaje.cliente_id ?? "",
          numero_guia: viaje.numero_guia,
          origen: viaje.origen,
          destino: viaje.destino,
          equipo_id: viaje.equipo_id ?? "",
          km_inicial: viaje.km_inicial != null ? String(viaje.km_inicial) : "",
          km_final: viaje.km_final != null ? String(viaje.km_final) : "",
          subtotal: String(Math.round(viaje.subtotal)),
          aplica_iva: viaje.aplica_iva,
        });
      })
      .catch((e) => Alert.alert("No se pudo cargar el viaje", e instanceof Error ? e.message : "Intenta de nuevo"))
      .finally(() => setCargandoViaje(false));
  }, [editandoId]);

  const set = (k: keyof BorradorViaje, v: string | boolean) => setB((prev) => ({ ...prev, [k]: v }));

  async function adjuntarFoto() {
    const [elegida] = await elegirFotos({ titulo: "Foto de la guía" });
    if (elegida) setFoto(elegida);
  }

  async function guardar() {
    if (!b.cliente_id) return Alert.alert("Falta el cliente", "Elige un cliente.");
    if (!b.numero_guia.trim()) return Alert.alert("Falta la guía", "Ingresa el número de guía.");
    if (!b.origen.trim() || !b.destino.trim()) return Alert.alert("Falta la ruta", "Completa el origen y el destino.");
    if (!(Number(b.subtotal.replace(/\D/g, "")) > 0)) return Alert.alert("Falta el monto", "Ingresa el monto del viaje.");
    const ki = Number(b.km_inicial),
      kf = Number(b.km_final);
    if (b.km_inicial && b.km_final && kf < ki) {
      return Alert.alert("Revisa los kilómetros", "El km final no puede ser menor que el inicial.");
    }

    const f = fechaViaje;
    const fechaTexto = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
    const borrador = { ...b, subtotal: b.subtotal.replace(/\D/g, ""), ...(b.chofer_id ? { fecha: fechaTexto } : {}) };
    if (borrador.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(borrador.hora)) {
      return Alert.alert("Revisa la hora", "Usa el formato HH:MM, por ejemplo 08:30.");
    }
    const volverForm = () => navigation.goBack();
    setGuardando(true);

    if (editandoId) {
      if (!enLinea) {
        setGuardando(false);
        return Alert.alert("Sin conexión", "Necesitas conexión para editar un viaje.");
      }
      const r = await editarViaje(editandoId, {
        numero_guia: borrador.numero_guia,
        origen: borrador.origen,
        destino: borrador.destino,
        cliente_id: borrador.cliente_id,
        km_inicial: borrador.km_inicial,
        km_final: borrador.km_final,
        subtotal: borrador.subtotal,
        aplica_iva: borrador.aplica_iva,
      });
      setGuardando(false);
      if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
      Alert.alert("Viaje actualizado", "Listo.", [{ text: "Listo", onPress: volverForm }]);
      return;
    }

    // Asignar a un chofer necesita conexión: la oficina valida al chofer
    // y le avisa en el momento (no pasa por la cola offline).
    if (borrador.chofer_id && !enLinea) {
      setGuardando(false);
      return Alert.alert("Sin conexión", "Necesitas conexión para asignar un viaje a un chofer.");
    }

    if (enLinea) {
      const r = await crearViaje(borrador, foto ?? undefined);
      if (r.ok) {
        setGuardando(false);
        Alert.alert(
          "Viaje registrado",
          r.fotoPendiente
            ? "Llegó a la oficina. La foto de la guía se está subiendo y se reintenta sola si falla."
            : "Llegó a la oficina. Queda pendiente de aprobación.",
          [{ text: "Listo", onPress: volverForm }]
        );
        return;
      }
      if (!r.reintentable) {
        setGuardando(false);
        Alert.alert("No se pudo registrar", r.error);
        return;
      }
      // Señal inestable o servidor caído: lo guardamos y la cola lo reintenta sola.
      await encolarViaje(borrador, foto ?? undefined);
      setGuardando(false);
      Alert.alert(
        "Se reintentará solo",
        "No se pudo enviar ahora (conexión o servidor). Lo guardamos y se reenvía cuando haya señal — lo ves en la lista de Viajes.",
        [{ text: "Listo", onPress: volverForm }]
      );
      return;
    }

    await encolarViaje(borrador, foto ?? undefined);
    setGuardando(false);
    Alert.alert("Guardado sin conexión", "Se enviará a la oficina cuando vuelvas a tener señal.", [
      { text: "Listo", onPress: volverForm },
    ]);
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };
  const titulo = editandoId ? "Editar viaje" : "Nuevo viaje";

  if (clientes === null || cargandoViaje) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={titulo} accion={volver} />
        <View style={{ padding: tokens.space["4"], gap: tokens.space["3"] }}>
          <LoadingState>
            <Skeleton alto={44} radio={999} />
            <Skeleton alto={44} radio={999} />
            <Skeleton alto={120} radio={16} />
          </LoadingState>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo={titulo} accion={volver} />
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}
        keyboardShouldPersistTaps="handled"
      >
        <SelectorCliente
          valor={b.cliente_id}
          onElegir={(id) => set("cliente_id", id)}
          clientes={clientes}
          onClienteCreado={(c) => setClientes((prev) => [...(prev ?? []), c])}
        />

        <Input etiqueta="Número de guía" valor={b.numero_guia} onCambio={(v) => set("numero_guia", v)} />

        {puedeAsignar ? (
          <Card>
            <View style={{ gap: tokens.space["2"] }}>
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ letterSpacing: 1 }}>
                ASIGNAR A UN CHOFER (OPCIONAL)
              </Texto>
              <PickerBuscable
                etiqueta="Chofer"
                valor={b.chofer_id ?? ""}
                opcionVacia="Yo mismo"
                opciones={choferes.map((c) => ({ id: c.id, label: c.nombre }))}
                onElegir={(v) => set("chofer_id", v)}
              />
              {b.chofer_id ? (
                <>
                  <DatePicker etiqueta="Fecha del viaje" valor={fechaViaje} onCambio={(d) => d && setFechaViaje(d)} />
                  <Input etiqueta="Hora de salida (opcional)" tipo="hora" valor={b.hora ?? ""} onCambio={(v) => set("hora", v)} placeholder="08:30" />
                </>
              ) : null}
            </View>
          </Card>
        ) : null}

        {!editandoId ? (
          <Card>
            <View style={{ gap: tokens.space["2"] }}>
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ letterSpacing: 1 }}>
                FOTO DE LA GUÍA
              </Texto>
              {foto ? (
                <View style={{ flexDirection: "row", gap: tokens.space["3"], alignItems: "center" }}>
                  <Image source={{ uri: foto.uri }} style={{ width: 72, height: 72, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] }} />
                  <View style={{ flex: 1, gap: tokens.space["2"] }}>
                    <Button variante="secundario" bloque onPress={adjuntarFoto}>
                      Cambiar
                    </Button>
                    <Button variante="peligro" bloque onPress={() => setFoto(null)}>
                      Quitar
                    </Button>
                  </View>
                </View>
              ) : (
                <Button variante="primario" bloque onPress={adjuntarFoto}>
                  Adjuntar foto de la guía
                </Button>
              )}
            </View>
          </Card>
        ) : null}

        <PickerBuscable
          etiqueta="Origen"
          placeholder="Elegir ciudad de origen"
          valor={b.origen}
          opciones={CIUDADES_CHILE.map((c) => ({ id: c, label: c }))}
          onElegir={(v) => set("origen", v)}
          permitirLibre
          textoLibre={(texto) => `Usar "${texto}" (no está en la lista)`}
        />
        <PickerBuscable
          etiqueta="Destino"
          placeholder="Elegir ciudad de destino"
          valor={b.destino}
          opciones={CIUDADES_CHILE.map((c) => ({ id: c, label: c }))}
          onElegir={(v) => set("destino", v)}
          permitirLibre
          textoLibre={(texto) => `Usar "${texto}" (no está en la lista)`}
        />

        {equipos.length > 0 ? (
          <PickerBuscable
            etiqueta="Vehículo (opcional)"
            valor={b.equipo_id ?? ""}
            opcionVacia="Ninguno"
            opciones={equipos.map((e) => ({ id: e.id, label: e.nombre, sublabel: e.patente ?? undefined }))}
            onElegir={(id) => set("equipo_id", id)}
          />
        ) : null}

        <View style={{ flexDirection: "row", gap: tokens.space["3"] }}>
          <View style={{ flex: 1 }}>
            <Input etiqueta="Km inicial" tipo="numero" valor={b.km_inicial ?? ""} onCambio={(v) => set("km_inicial", v)} />
          </View>
          <View style={{ flex: 1 }}>
            <Input etiqueta="Km final" tipo="numero" valor={b.km_final ?? ""} onCambio={(v) => set("km_final", v)} />
          </View>
        </View>

        {puedeEditarMonto ? (
          <>
            <InputMonto etiqueta="Monto del viaje (sin IVA)" valor={b.subtotal} onChangeText={(v) => set("subtotal", v)} />

            <Pressable
              onPress={() => set("aplica_iva", !b.aplica_iva)}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.space["3"],
                minHeight: 44,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {b.aplica_iva ? (
                <View style={{ width: 24, height: 24, borderRadius: tokens.radius.sm, backgroundColor: marca.base, alignItems: "center", justifyContent: "center" }}>
                  <Check size={16} strokeWidth={3} color={marca.foreground} />
                </View>
              ) : (
                <Square size={24} strokeWidth={2} color={`${tokens.color.text}66`} />
              )}
              <Texto tamano={tokens.size.body} color={tokens.color.text}>
                Aplicar IVA (19%)
              </Texto>
            </Pressable>
          </>
        ) : (
          <View style={{ gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
              Monto del viaje
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold" style={{ fontVariant: ["tabular-nums"] }}>
              ${Number(b.subtotal || 0).toLocaleString("es-CL")}
              {b.aplica_iva ? " + IVA" : " (sin IVA)"}
            </Texto>
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
              El monto lo cambia la oficina.
            </Texto>
          </View>
        )}

        {viatico ? (
          <View style={{ gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
              Viático {viatico.tipo === "local" ? "local" : "interregional"}
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold" style={{ fontVariant: ["tabular-nums"] }}>
              ${Math.round(viatico.monto).toLocaleString("es-CL")}
            </Texto>
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
              Lo asigna la oficina y se paga al chofer del viaje.
            </Texto>
          </View>
        ) : null}
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
          {editandoId ? "Guardar cambios" : "Registrar viaje"}
        </Button>
      </View>
    </View>
  );
}
