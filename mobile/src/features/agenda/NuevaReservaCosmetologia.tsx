import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, PaqueteSesionesConSaldo, Servicio, Usuario } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Input, Text } from "../../components/ui";
import { SelectorCliente } from "../../components/SelectorCliente";
import { useRed } from "../../services/sync/NetworkProvider";
import { formatearMoneda } from "../../lib/plata";
import { formatearFechaCompleta, sumarMinutos } from "../../lib/horario";
import { catalogoParaCita, crearCita, editarCita, listarTareasRango, type BorradorCita } from "../../services/agenda";
import { listarServicios } from "../../services/servicios";
import { listarPaquetesCliente } from "../../services/paquetes";
import { obtenerAgendaProConfig, type AgendaProConfigCompleta } from "../../services/agendaProConfig";
import { SelectorHoraCosmetologia } from "./SelectorHoraCosmetologia";
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
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [agendaConfig, setAgendaConfig] = useState<AgendaProConfigCompleta | null>(null);
  const [paquetesCliente, setPaquetesCliente] = useState<PaqueteSesionesConSaldo[]>([]);
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

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

  const servicioElegido = servicios.find((s) => s.id === servicioId) ?? null;
  const hoy = clave(new Date());
  const paqueteDetectado = useMemo(() => {
    if (!servicioId) return null;
    return (
      paquetesCliente.find((p) => p.servicio_id === servicioId && p.saldo > 0 && (!p.vence_el || p.vence_el >= hoy)) ?? null
    );
  }, [paquetesCliente, servicioId, hoy]);

  function elegirServicio(id: string) {
    setServicioId(id);
    const s = servicios.find((x) => x.id === id);
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
  const resumen = `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} · ${hora ? `${hora}–${horaFin}` : "sin hora"} · ${responsableNombre}${
    paqueteDetectado ? ` · descuenta 1 de ${paqueteDetectado.saldo}` : ""
  }`;

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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
            {servicios.map((s) => (
              <Chip key={s.id} etiqueta={s.nombre} activo={s.id === servicioId} onPress={() => elegirServicio(s.id)} />
            ))}
          </View>
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
        <Input
          etiqueta="Precio"
          keyboardType="numeric"
          placeholder="0"
          value={precio}
          onChangeText={(v) => setPrecio(v.replace(/\D/g, ""))}
        />
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
    </View>
  );
}
