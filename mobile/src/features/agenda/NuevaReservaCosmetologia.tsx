import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, X } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, PaqueteSesionesConSaldo, Servicio, Usuario } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, LoadingState, ScreenHeader, Textarea, Texto, useMarca, useToast } from "@bitacora/ui/native";
import { InputMonto } from "../../components/InputMonto";
import { SelectorCliente } from "../../components/SelectorCliente";
import { useRed } from "../../services/sync/NetworkProvider";
import { formatearMoneda } from "../../lib/plata";
import { formatearFechaCompleta, sumarMinutos } from "../../lib/horario";
import { catalogoParaCita, crearCita, editarCita, listarTareasRango, type BorradorCita } from "../../services/agenda";
import { listarServicios } from "../../services/servicios";
import { listarPaquetesCliente } from "../../services/paquetes";
import { obtenerAgendaProConfig, type AgendaProConfigCompleta } from "../../services/agendaProConfig";
import { SelectorHoraCosmetologia } from "./SelectorHoraCosmetologia";
import { NuevoServicioModal } from "./NuevoServicioModal";
import type { AgendaStackParamList } from "../../shell/navigation/types";

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DURACIONES = [30, 45, 60, 90];

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Chip({ etiqueta, activo, onPress }: { etiqueta: string; activo: boolean; onPress: () => void }) {
  const marca = useMarca();
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 40,
        justifyContent: "center",
        paddingHorizontal: tokens.space["3"],
        borderRadius: tokens.radius.md,
        backgroundColor: activo ? marca.suave : tokens.color.surface,
        borderWidth: 1,
        borderColor: activo ? marca.base : tokens.color.divider,
      }}
    >
      <Texto tamano={tokens.size.small} peso="semibold" color={activo ? marca.fuerte : tokens.color.text}>
        {etiqueta}
      </Texto>
    </Pressable>
  );
}

function Filete() {
  return <View style={{ height: 1, backgroundColor: tokens.color.divider }} />;
}

/**
 * Nueva reserva — tema "Vino y eucalipto" (cosmetología). Reemplaza
 * NuevaCitaScreen SOLO para este rubro y solo para creación (editar una
 * cita existente sigue usando el formulario genérico).
 *
 * Sistema visual móvil v2 (14-sep-2026) — ScreenHeader propio con
 * `accion`=volver: como esta pantalla se renderiza DENTRO de la misma
 * ruta "NuevaCita" (ver NuevaCitaScreen), el header nativo del stack
 * (que sigue activo para el formulario genérico) se apaga a mano acá
 * con `navigation.setOptions({ headerShown: false })` — mismo mecanismo
 * que ya usaba este archivo para poner el título dinámico.
 */
export function NuevaReservaCosmetologia({ navigation, route }: NativeStackScreenProps<AgendaStackParamList, "NuevaCita">) {
  const marca = useMarca();
  const toast = useToast();
  // Pantalla modal (presentation: "modal" en AgendaStack.tsx, misma
  // ruta "NuevaCita" que NuevaCitaScreen.tsx) — no vive dentro del pager
  // de AppTabs.tsx, así que no hereda el fix de paddingBottom de la tab
  // bar (ver ese archivo, 20-sep-2026). Necesita su propio insets.bottom
  // para no quedar detrás de la barra de gestos/navegación de Android —
  // acá importa el doble, porque además del scroll hay una barra fija
  // de acción abajo de todo con el botón de guardar.
  const insets = useSafeAreaInsets();
  const { enLinea } = useRed();
  const fechaInicial = route.params?.fecha ?? clave(new Date());

  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  // null = todavía cargando; [] = catálogo vacío (hay que crear servicios
  // en la web). Sin esta distinción, un catálogo vacío dejaba la sección
  // "Servicio" en blanco, sin explicación ni salida.
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [agendaConfig, setAgendaConfig] = useState<AgendaProConfigCompleta | null>(null);
  const [paquetesCliente, setPaquetesCliente] = useState<PaqueteSesionesConSaldo[]>([]);
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [nuevoServicioAbierto, setNuevoServicioAbierto] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [hora, setHora] = useState("");
  const [duracionMin, setDuracionMin] = useState(45);
  const [duracionLibre, setDuracionLibre] = useState(false);
  const [precio, setPrecio] = useState("");
  const [estadoInicial, setEstadoInicial] = useState<"pendiente" | "confirmada">("pendiente");
  const [avisarWhatsapp, setAvisarWhatsapp] = useState(true);
  const [notaCliente, setNotaCliente] = useState("");
  const [notaInterna, setNotaInterna] = useState("");
  // "Valor agregado": extras que se suman al precio del servicio.
  const [adicionales, setAdicionales] = useState<{ concepto: string; monto: string }[]>([]);

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  useEffect(() => {
    navigation.setOptions({ title: "Nueva reserva", headerShown: false });
  }, [navigation]);

  useEffect(() => {
    catalogoParaCita().then(({ clientes, equipo }) => {
      setClientes(clientes.filter((c) => c.activo));
      setEquipo(equipo);
    });
    listarServicios().then(setServicios);
    obtenerAgendaProConfig().then(setAgendaConfig);
  }, []);

  useEffect(() => {
    if (!clienteId) {
      setPaquetesCliente([]);
      return;
    }
    listarPaquetesCliente(clienteId).then(setPaquetesCliente);
  }, [clienteId]);

  useEffect(() => {
    let vivo = true;
    listarTareasRango(fecha, fecha).then(({ tareas }) => {
      if (!vivo) return;
      setOcupadas(new Set(tareas.filter((t) => t.hora).map((t) => t.hora!.slice(0, 5))));
    });
    return () => {
      vivo = false;
    };
  }, [fecha]);

  const servicioElegido = servicios?.find((s) => s.id === servicioId) ?? null;
  const hoy = clave(new Date());
  const paqueteDetectado = useMemo(() => {
    if (!servicioId) return null;
    return (
      paquetesCliente.find((p) => p.servicio_id === servicioId && p.saldo > 0 && (!p.vence_el || p.vence_el >= hoy)) ?? null
    );
  }, [paquetesCliente, servicioId, hoy]);

  function elegirServicio(id: string) {
    setServicioId(id);
    const s = servicios?.find((x) => x.id === id);
    if (s) {
      setDuracionMin(s.duracion_sugerida_min);
      setDuracionLibre(!DURACIONES.includes(s.duracion_sugerida_min));
      setPrecio(String(s.precio));
    }
  }

  async function guardar() {
    if (!clienteId) return toast("Falta el cliente: elige o crea un cliente para la reserva.", { tono: "error" });
    if (!servicioId) return toast("Falta el servicio: elige qué servicio se va a realizar.", { tono: "error" });
    if (!hora) return toast("Falta la hora: elige un horario en el bloque de arriba.", { tono: "error" });
    if (!enLinea) return toast("Sin conexión: necesitas conexión para agendar.", { tono: "error" });

    const nombreServicio = servicioElegido?.nombre ?? "Reserva";
    const adicionalesLimpios = adicionales
      .map((a) => ({ concepto: a.concepto.trim(), monto: Number(a.monto.replace(/\D/g, "")) || 0 }))
      .filter((a) => a.concepto && a.monto > 0);
    const borrador: BorradorCita = {
      titulo: nombreServicio,
      fecha,
      hora,
      duracion_min: String(duracionMin),
      cliente_id: clienteId,
      responsable_id: responsableId,
      descripcion: notaInterna,
      prioridad: "media",
      paquete_id: paqueteDetectado?.id ?? "",
      sesiones_consumidas: 1,
      servicio_id: servicioId,
      nota_cliente: notaCliente,
      avisar_whatsapp: avisarWhatsapp,
      precio,
      adicionales: adicionalesLimpios,
    };

    setGuardando(true);
    const r = await crearCita(borrador);
    setGuardando(false);
    if (!r.ok) {
      toast(`No se pudo agendar: ${r.error}`, { tono: "error" });
      return;
    }
    if (estadoInicial === "confirmada") {
      // Segunda escritura solo si corresponde — la mayoría de las
      // reservas nace en "pendiente", que ya vino en el POST.
      await editarCita(r.tarea.id, { estado: "confirmada" });
    }
    toast("Reserva agendada", { tono: "exito" });
    navigation.goBack();
  }

  if (clientes === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Nueva reserva" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  const responsableNombre = equipo.find((u) => u.id === responsableId)?.nombre ?? "sin asignar";
  const horaFin = hora ? sumarMinutos(hora, duracionMin) : null;
  const d = new Date(`${fecha}T00:00:00`);
  const totalAdicionales = adicionales.reduce((s, a) => s + (Number(a.monto.replace(/\D/g, "")) || 0), 0);
  const totalReserva = (Number(precio.replace(/\D/g, "")) || 0) + totalAdicionales;
  const resumen = `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} · ${hora ? `${hora}–${horaFin}` : "sin hora"} · ${responsableNombre}${
    paqueteDetectado ? ` · descuenta 1 de ${paqueteDetectado.saldo}` : ""
  }${totalReserva > 0 ? ` · total ${formatearMoneda(totalReserva)}` : ""}`;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Nueva reserva" accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }} keyboardShouldPersistTaps="handled">
        {/* Cliente */}
        <SelectorCliente
          etiqueta="Cliente"
          valor={clienteId}
          onElegir={setClienteId}
          clientes={clientes}
          onClienteCreado={(c) => setClientes((prev) => [...(prev ?? []), c])}
        />
        <Filete />

        {/* Servicio */}
        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            Servicio
          </Texto>
          {servicios === null ? (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Cargando servicios…
            </Texto>
          ) : servicios.length === 0 ? (
            <View style={{ backgroundColor: tokens.color.neutral["200"], borderRadius: tokens.radius.md, padding: tokens.space["3"], gap: tokens.space["2"] }}>
              <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text}>
                Todavía no hay servicios en el catálogo
              </Texto>
              <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                Créalos acá o desde la web (Configuración → Agenda Pro → Servicios).
              </Texto>
              <Button variante="secundario" onPress={() => setNuevoServicioAbierto(true)}>
                ＋ Nuevo servicio
              </Button>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
              {servicios.map((s) => (
                <Chip key={s.id} etiqueta={s.nombre} activo={s.id === servicioId} onPress={() => elegirServicio(s.id)} />
              ))}
              <Chip etiqueta="＋ Nuevo servicio" activo={false} onPress={() => setNuevoServicioAbierto(true)} />
            </View>
          )}
        </View>

        {paqueteDetectado ? (
          <View style={{ backgroundColor: tokens.color.accent2Ramp["200"], borderRadius: tokens.radius.lg, padding: tokens.space["4"], gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.body} color={tokens.color.accent2Ramp["800"]} peso="semibold">
              {paqueteDetectado.nombre} — quedan {paqueteDetectado.saldo} de {paqueteDetectado.cantidad_total}
            </Texto>
            <Texto tamano={tokens.size.caption} color={tokens.color.accent2Ramp["700"]}>
              {paqueteDetectado.vence_el ? `Vence el ${formatearFechaCompleta(paqueteDetectado.vence_el)}` : "Sin vencimiento"} · se
              usa automáticamente para esta reserva
            </Texto>
          </View>
        ) : null}
        <Filete />

        {/* Atiende */}
        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            Atiende
          </Texto>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
            {equipo.map((u) => (
              <Chip key={u.id} etiqueta={u.nombre} activo={u.id === responsableId} onPress={() => setResponsableId(u.id)} />
            ))}
          </View>
        </View>
        <Filete />

        {/* Bloque de hora — único enmarcado */}
        <SelectorHoraCosmetologia
          fecha={fecha}
          hora={hora}
          duracionMin={duracionMin}
          config={agendaConfig?.config ?? null}
          horarios={agendaConfig?.horarios ?? []}
          ocupadas={ocupadas}
          onCambiarFecha={(f) => {
            setFecha(f);
            setHora("");
          }}
          onCambiarHora={setHora}
        />
        <Filete />

        {/* Duración */}
        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            Duración
          </Texto>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
            {DURACIONES.map((min) => (
              <Chip
                key={min}
                etiqueta={`${min} min`}
                activo={!duracionLibre && duracionMin === min}
                onPress={() => {
                  setDuracionLibre(false);
                  setDuracionMin(min);
                }}
              />
            ))}
            <Chip etiqueta="Otra" activo={duracionLibre} onPress={() => setDuracionLibre(true)} />
          </View>
          {duracionLibre ? (
            <Input
              tipo="numero"
              placeholder="Minutos"
              valor={String(duracionMin)}
              onCambio={(v) => setDuracionMin(Math.max(1, Number(v.replace(/\D/g, "")) || 1))}
            />
          ) : null}
        </View>
        <Filete />

        {/* Precio */}
        <InputMonto etiqueta="Precio del servicio" valor={precio} onChangeText={setPrecio} />
        <Filete />

        {/* Adicionales — "valor agregado" */}
        <View style={{ gap: tokens.space["2"] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              Adicionales
            </Texto>
            <Pressable onPress={() => setAdicionales((prev) => [...prev, { concepto: "", monto: "" }])} hitSlop={8}>
              <Texto tamano={tokens.size.caption} peso="semibold" color={marca.base}>
                ＋ Agregar
              </Texto>
            </Pressable>
          </View>
          {adicionales.length === 0 ? (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Productos o extras que se cobran encima del servicio.
            </Texto>
          ) : (
            adicionales.map((a, i) => (
              <View key={i} style={{ flexDirection: "row", gap: tokens.space["2"], alignItems: "flex-end" }}>
                <View style={{ flex: 2 }}>
                  <Input
                    etiqueta="Concepto"
                    placeholder="Producto o extra"
                    valor={a.concepto}
                    onCambio={(v) =>
                      setAdicionales((prev) => prev.map((x, j) => (j === i ? { ...x, concepto: v } : x)))
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputMonto
                    etiqueta="Monto"
                    valor={a.monto}
                    onChangeText={(d) => setAdicionales((prev) => prev.map((x, j) => (j === i ? { ...x, monto: d } : x)))}
                  />
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Quitar servicio adicional"
                  onPress={() => setAdicionales((prev) => prev.filter((_, j) => j !== i))}
                  hitSlop={8}
                  style={{ marginBottom: tokens.space["2"] * 1.25 }}
                >
                  <X size={22} color={tokens.color.textSecondary} />
                </Pressable>
              </View>
            ))
          )}
          {totalAdicionales > 0 ? (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Total reserva: {formatearMoneda(totalReserva)} (servicio {formatearMoneda(Number(precio.replace(/\D/g, "")) || 0)} + adicionales {formatearMoneda(totalAdicionales)})
            </Texto>
          ) : null}
        </View>
        <Filete />

        {/* Estado inicial */}
        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            Estado inicial
          </Texto>
          <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
            <Chip etiqueta="Reservado" activo={estadoInicial === "pendiente"} onPress={() => setEstadoInicial("pendiente")} />
            <Chip etiqueta="Confirmado" activo={estadoInicial === "confirmada"} onPress={() => setEstadoInicial("confirmada")} />
          </View>
        </View>
        <Filete />

        {/* WhatsApp */}
        <Pressable
          onPress={() => setAvisarWhatsapp((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Texto tamano={tokens.size.body} color={tokens.color.text}>
            Avisar por WhatsApp
          </Texto>
          <View
            style={{
              width: 44,
              height: 26,
              borderRadius: tokens.radius.pill,
              padding: 2,
              backgroundColor: avisarWhatsapp ? tokens.color.accent2Ramp["700"] : tokens.color.divider,
              alignItems: avisarWhatsapp ? "flex-end" : "flex-start",
            }}
          >
            <View style={{ width: 22, height: 22, borderRadius: tokens.radius.pill, backgroundColor: tokens.color.neutral["100"] }} />
          </View>
        </Pressable>
        <Filete />

        {/* Notas */}
        <Textarea
          etiqueta="Nota para el cliente (opcional)"
          placeholder="Va en el correo/portal del cliente"
          valor={notaCliente}
          onCambio={setNotaCliente}
        />
        <View style={{ backgroundColor: tokens.color.neutral["200"], borderRadius: tokens.radius.md, padding: tokens.space["3"] }}>
          <Textarea
            etiqueta="Nota interna (opcional)"
            placeholder="No la ve el cliente"
            valor={notaInterna}
            onCambio={setNotaInterna}
          />
          <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ marginTop: tokens.space["1"] }}>
            No la ve el cliente.
          </Texto>
        </View>
      </ScrollView>

      {/* Pie fijo — el que de verdad necesita insets.bottom (queda al
          borde real de la pantalla, a diferencia del padding del
          ScrollView de arriba, que solo da aire antes de llegar acá). */}
      <View
        style={{
          padding: tokens.space["4"],
          paddingBottom: tokens.space["6"] + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: tokens.color.divider,
          backgroundColor: tokens.color.surface,
          gap: tokens.space["1"] * 1.5,
        }}
      >
        <Button tamano="lg" bloque onPress={guardar} cargando={guardando}>
          Agendar
        </Button>
        <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ textAlign: "center" }}>
          {resumen}
        </Texto>
      </View>

      <NuevoServicioModal
        visible={nuevoServicioAbierto}
        onCerrar={() => setNuevoServicioAbierto(false)}
        onGuardado={(s) => {
          setServicios((prev) => [...(prev ?? []), s].sort((a, b) => a.nombre.localeCompare(b.nombre)));
          setServicioId(s.id);
          setDuracionMin(s.duracion_sugerida_min);
          setDuracionLibre(!DURACIONES.includes(s.duracion_sugerida_min));
          setPrecio(String(s.precio));
          setNuevoServicioAbierto(false);
        }}
      />
    </View>
  );
}
