import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, PaqueteSesionesConSaldo, Servicio, Usuario } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Input, Text } from "../../components/ui";
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
  const t = useTema();
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 40,
        justifyContent: "center",
        paddingHorizontal: t.espacio(3.5),
        borderRadius: t.radio.md,
        backgroundColor: activo ? t.colores.brand : t.colores.surface,
        borderWidth: 1,
        borderColor: activo ? t.colores.brand : t.colores.border,
      }}
    >
      <Text variante="etiqueta" weight="semibold" tono={activo ? "inverso" : "normal"}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

function Filete() {
  const t = useTema();
  return <View style={{ height: 1, backgroundColor: t.colores.border }} />;
}

/**
 * Nueva reserva — tema "Vino y eucalipto" (cosmetología). Reemplaza
 * NuevaCitaScreen SOLO para este rubro y solo para creación (editar una
 * cita existente sigue usando el formulario genérico).
 */
export function NuevaReservaCosmetologia({ navigation, route }: NativeStackScreenProps<AgendaStackParamList, "NuevaCita">) {
  const t = useTema();
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

  useEffect(() => {
    navigation.setOptions({ title: "Nueva reserva" });
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
    if (!clienteId) return Alert.alert("Falta el cliente", "Elige o crea un cliente para la reserva.");
    if (!servicioId) return Alert.alert("Falta el servicio", "Elige qué servicio se va a realizar.");
    if (!hora) return Alert.alert("Falta la hora", "Elige un horario en el bloque de arriba.");
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para agendar.");

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
      Alert.alert("No se pudo agendar", r.error);
      return;
    }
    if (estadoInicial === "confirmada") {
      // Segunda escritura solo si corresponde — la mayoría de las
      // reservas nace en "pendiente", que ya vino en el POST.
      await editarCita(r.tarea.id, { estado: "confirmada" });
    }
    Alert.alert("Reserva agendada", "Listo.", [{ text: "Listo", onPress: () => navigation.goBack() }]);
  }

  if (clientes === null) return null;

  const responsableNombre = equipo.find((u) => u.id === responsableId)?.nombre ?? "sin asignar";
  const horaFin = hora ? sumarMinutos(hora, duracionMin) : null;
  const d = new Date(`${fecha}T00:00:00`);
  const totalAdicionales = adicionales.reduce((s, a) => s + (Number(a.monto.replace(/\D/g, "")) || 0), 0);
  const totalReserva = (Number(precio.replace(/\D/g, "")) || 0) + totalAdicionales;
  const resumen = `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} · ${hora ? `${hora}–${horaFin}` : "sin hora"} · ${responsableNombre}${
    paqueteDetectado ? ` · descuenta 1 de ${paqueteDetectado.saldo}` : ""
  }${totalReserva > 0 ? ` · total ${formatearMoneda(totalReserva)}` : ""}`;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(8) }} keyboardShouldPersistTaps="handled">
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
        <View style={{ gap: t.espacio(2) }}>
          <Text variante="etiqueta" tono="muted">
            Servicio
          </Text>
          {servicios === null ? (
            <Text variante="caption" tono="muted">
              Cargando servicios…
            </Text>
          ) : servicios.length === 0 ? (
            <View style={{ backgroundColor: t.colores.surfaceAlt, borderRadius: t.radio.md, padding: t.espacio(3), gap: t.espacio(2) }}>
              <Text variante="etiqueta" weight="semibold">
                Todavía no hay servicios en el catálogo
              </Text>
              <Text variante="caption" tono="muted">
                Créalos acá o desde la web (Configuración → Agenda Pro → Servicios).
              </Text>
              <Button titulo="＋ Nuevo servicio" variante="secundario" onPress={() => setNuevoServicioAbierto(true)} />
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
              {servicios.map((s) => (
                <Chip key={s.id} etiqueta={s.nombre} activo={s.id === servicioId} onPress={() => elegirServicio(s.id)} />
              ))}
              <Chip etiqueta="＋ Nuevo servicio" activo={false} onPress={() => setNuevoServicioAbierto(true)} />
            </View>
          )}
        </View>

        {paqueteDetectado ? (
          <View style={{ backgroundColor: t.colores.successSoft, borderRadius: t.radio.lg, padding: t.espacio(4), gap: t.espacio(1) }}>
            <Text tono="success" weight="bold">
              {paqueteDetectado.nombre} — quedan {paqueteDetectado.saldo} de {paqueteDetectado.cantidad_total}
            </Text>
            <Text variante="caption" tono="success">
              {paqueteDetectado.vence_el ? `Vence el ${formatearFechaCompleta(paqueteDetectado.vence_el)}` : "Sin vencimiento"} · se
              usa automáticamente para esta reserva
            </Text>
          </View>
        ) : null}
        <Filete />

        {/* Atiende */}
        <View style={{ gap: t.espacio(2) }}>
          <Text variante="etiqueta" tono="muted">
            Atiende
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
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
        <View style={{ gap: t.espacio(2) }}>
          <Text variante="etiqueta" tono="muted">
            Duración
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
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
              keyboardType="numeric"
              placeholder="Minutos"
              value={String(duracionMin)}
              onChangeText={(v) => setDuracionMin(Math.max(1, Number(v.replace(/\D/g, "")) || 1))}
            />
          ) : null}
        </View>
        <Filete />

        {/* Precio */}
        <InputMonto etiqueta="Precio del servicio" valor={precio} onChangeText={setPrecio} />
        <Filete />

        {/* Adicionales — "valor agregado" */}
        <View style={{ gap: t.espacio(2) }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variante="etiqueta" tono="muted">
              Adicionales
            </Text>
            <Pressable onPress={() => setAdicionales((prev) => [...prev, { concepto: "", monto: "" }])} hitSlop={8}>
              <Text variante="caption" weight="semibold" tono="brand">
                ＋ Agregar
              </Text>
            </Pressable>
          </View>
          {adicionales.length === 0 ? (
            <Text variante="caption" tono="muted">
              Productos o extras que se cobran encima del servicio.
            </Text>
          ) : (
            adicionales.map((a, i) => (
              <View key={i} style={{ flexDirection: "row", gap: t.espacio(2), alignItems: "flex-end" }}>
                <View style={{ flex: 2 }}>
                  <Input
                    etiqueta="Concepto"
                    placeholder="Producto o extra"
                    value={a.concepto}
                    onChangeText={(v) =>
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
                <Pressable
                  onPress={() => setAdicionales((prev) => prev.filter((_, j) => j !== i))}
                  hitSlop={8}
                  style={{ marginBottom: t.espacio(2.5) }}
                >
                  <Ionicons name="close-circle" size={22} color={t.colores.muted} />
                </Pressable>
              </View>
            ))
          )}
          {totalAdicionales > 0 ? (
            <Text variante="caption" tono="muted">
              Total reserva: {formatearMoneda(totalReserva)} (servicio {formatearMoneda(Number(precio.replace(/\D/g, "")) || 0)} + adicionales {formatearMoneda(totalAdicionales)})
            </Text>
          ) : null}
        </View>
        <Filete />

        {/* Estado inicial */}
        <View style={{ gap: t.espacio(2) }}>
          <Text variante="etiqueta" tono="muted">
            Estado inicial
          </Text>
          <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
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
          <Text variante="cuerpo">Avisar por WhatsApp</Text>
          <View
            style={{
              width: 44,
              height: 26,
              borderRadius: 999,
              padding: 2,
              backgroundColor: avisarWhatsapp ? t.colores.success : t.colores.border,
              alignItems: avisarWhatsapp ? "flex-end" : "flex-start",
            }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: "#fff" }} />
          </View>
        </Pressable>
        <Filete />

        {/* Notas */}
        <Input
          etiqueta="Nota para el cliente (opcional)"
          placeholder="Va en el correo/portal del cliente"
          multiline
          value={notaCliente}
          onChangeText={setNotaCliente}
        />
        <View style={{ backgroundColor: t.colores.surfaceAlt, borderRadius: t.radio.md, padding: t.espacio(3) }}>
          <Input
            etiqueta="Nota interna (opcional)"
            placeholder="No la ve el cliente"
            multiline
            value={notaInterna}
            onChangeText={setNotaInterna}
          />
          <Text variante="caption" tono="muted" style={{ marginTop: t.espacio(1) }}>
            No la ve el cliente.
          </Text>
        </View>
      </ScrollView>

      {/* Pie fijo */}
      <View style={{ padding: t.espacio(4), paddingBottom: t.espacio(6), borderTopWidth: 1, borderTopColor: t.colores.border, backgroundColor: t.colores.surface, gap: t.espacio(1.5) }}>
        <Button titulo="Agendar" tamano="lg" onPress={guardar} cargando={guardando} />
        <Text variante="caption" tono="muted" style={{ textAlign: "center" }}>
          {resumen}
        </Text>
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
