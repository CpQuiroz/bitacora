import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Banknote, HardHat, Mail, MessageCircle, Phone, Receipt } from "lucide-react-native";
import type { PaqueteSesionesConSaldo, VentaConLineas } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, ErrorState, ListRow, ListRowGrupo, LoadingState, ScreenHeader, Skeleton, StatusBadge, Texto, useMarca } from "@bitacora/ui/native";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { editarCliente, obtenerClienteDetalle, saldoDeFacturas, type ClienteDetalle } from "../../services/clientes";
import { listarPaquetesCliente } from "../../services/paquetes";
import { ventasDeCliente } from "../../services/ventas";
import { pesos } from "../../lib/plata";
import { AsignarPackModal } from "./AsignarPackModal";
import type { ClientesStackParamList } from "../../shell/navigation/types";

const soloDigitos = (s: string) => s.replace(/[^\d]/g, "");

// Mismo mapa que ya usan Hoy/TrabajoDetalle (no extraído a un util
// compartido — ninguna de las 2 pantallas lo hizo tampoco).
const ETIQUETA_OS: Record<string, string> = {
  pendiente: "Sin empezar",
  enviada: "Sin empezar",
  en_proceso: "En proceso",
  completada: "Completado",
  firmada: "Finalizado",
  cancelada: "Cancelado",
};

// Sistema visual móvil v2 (14-sep-2026, tarea #21, piloto 4 — última
// pantalla del rollout) — a diferencia de Hoy/detalle de OS, esta
// pantalla NO estaba migrada al sistema de diseño base (seguía en
// useTema()/Ionicons/paleta Faena, ver Paso 0). Se migra completa acá:
// ScreenHeader (con `accion`=volver), Card para "Packs activos",
// ListRow/ListRowGrupo para los historiales de OS y cobros (antes
// filas de Pressable a mano) — a diferencia de "Hoy", estas filas NO
// tienen una columna de hora compitiendo con el ícono, así que ListRow
// calza bien sin forzarlo. Deliberadamente SIN AsistenteButton
// flotante, mismo criterio que TrabajoDetalleScreen: hay una acción
// primaria fija abajo ("Registrar venta").
export function ClienteDetalleScreen({ route, navigation }: NativeStackScreenProps<ClientesStackParamList, "ClienteDetalle">) {
  const marca = useMarca();
  const { clienteId } = route.params;
  const { enLinea } = useRed();
  const auth = useAuth();
  const tieneAgendaPro = auth.fase === "listo" && auth.modulosVisibles.includes("agenda_pro");
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [paquetes, setPaquetes] = useState<PaqueteSesionesConSaldo[]>([]);
  const [ventas, setVentas] = useState<VentaConLineas[]>([]);
  const [asignando, setAsignando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setCliente(await obtenerClienteDetalle(clienteId));
      void ventasDeCliente(clienteId).then(setVentas);
      if (tieneAgendaPro) void listarPaquetesCliente(clienteId).then(setPaquetes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el cliente");
    }
  }, [clienteId, tieneAgendaPro]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  const saldo = useMemo(() => saldoDeFacturas(cliente?.facturas ?? []), [cliente]);

  async function alternarActivo() {
    if (!cliente) return;
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para esto.");
    setOcupado(true);
    const r = await editarCliente(clienteId, {
      nombre: cliente.nombre,
      rut: cliente.rut ?? "",
      direccion: cliente.direccion,
      comuna: cliente.comuna ?? "",
      telefono: cliente.telefono ?? "",
      correo: cliente.correo ?? "",
      notas: cliente.notas ?? "",
      contacto_nombre: cliente.contacto_nombre ?? "",
      activo: !cliente.activo,
    });
    setOcupado(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
    cargar();
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!cliente && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Cliente" accion={volver} />
        <View style={{ padding: tokens.space["4"], gap: tokens.space["3"] }}>
          <LoadingState>
            <Skeleton alto={120} radio={28} />
            <Skeleton alto={44} radio={999} />
            <Skeleton alto={200} radio={16} />
          </LoadingState>
        </View>
      </View>
    );
  }
  if (error && !cliente) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Cliente" accion={volver} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }
  if (!cliente) return null;

  const ultimoTrabajo = cliente.trabajos[0];

  function registrarVenta() {
    if (!ultimoTrabajo) return Alert.alert("Sin OS", "Una venta nace de una cita o de una OS. Este cliente todavía no tiene ninguna.");
    navigation.navigate("RegistrarVenta", {
      origenTipo: "os",
      origenId: ultimoTrabajo.id,
      clienteId,
      clienteNombre: cliente!.nombre,
      clienteRut: cliente!.rut,
      folio: ultimoTrabajo.orden?.folio ?? null,
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        antetitulo={
          [formatearFolio("CLI", cliente.folio), cliente.rut].filter(Boolean).join(" · ") || undefined
        }
        titulo={cliente.nombre}
        accion={volver}
      />
      <ScrollView contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 3 }}>
        {/* Persona de contacto — solo si tiene valor, mismo criterio que
            el resto del sistema (estado real, no texto decorativo). */}
        {cliente.contacto_nombre ? (
          <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
            Contacto: {cliente.contacto_nombre}
          </Texto>
        ) : null}

        {!cliente.activo ? (
          <View style={{ alignSelf: "flex-start" }}>
            <StatusBadge estado="inactivo" />
          </View>
        ) : null}

        {/* Bloque de foco — mismo patrón que el check-in de TrabajoDetalleScreen */}
        <View style={{ backgroundColor: marca.suave, borderRadius: 32, padding: tokens.space["6"], gap: tokens.space["3"] }}>
          <Texto tamano={tokens.size.caption} color={`${marca.fuerte}b3`} style={{ letterSpacing: 1.2 }}>
            SALDO POR COBRAR
          </Texto>
          <Texto tamano={30} color={marca.fuerte} style={{ fontVariant: ["tabular-nums"] }}>
            {pesos(saldo.porCobrar)}
          </Texto>
          <View style={{ borderTopWidth: 1, borderTopColor: `${marca.fuerte}26`, paddingTop: tokens.space["3"] }}>
            <Texto tamano={tokens.size.caption} color={`${marca.fuerte}b3`} style={{ fontVariant: ["tabular-nums"] }}>
              {saldo.vencido > 0 ? `${pesos(saldo.vencido)} vencido` : "Nada vencido"}
              {"  ·  "}
              {saldo.documentos} {saldo.documentos === 1 ? "documento" : "documentos"}
            </Texto>
          </View>
        </View>

        {/* Contacto */}
        <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
          {cliente.telefono ? (
            <Button variante="secundario" bloque iconoIzq={<Phone size={16} strokeWidth={2.5} color={tokens.color.text} />} onPress={() => Linking.openURL(`tel:${cliente.telefono}`)}>
              Llamar
            </Button>
          ) : null}
          {cliente.correo ? (
            <Button variante="secundario" bloque iconoIzq={<Mail size={16} strokeWidth={2.5} color={tokens.color.text} />} onPress={() => Linking.openURL(`mailto:${cliente.correo}`)}>
              Correo
            </Button>
          ) : null}
          {cliente.telefono ? (
            <Button
              variante="secundario"
              bloque
              iconoIzq={<MessageCircle size={16} strokeWidth={2.5} color={tokens.color.accent2Ramp["700"]} />}
              onPress={() => Linking.openURL(`https://wa.me/${soloDigitos(cliente.telefono!)}`)}
            >
              WhatsApp
            </Button>
          ) : null}
        </View>

        {/* Packs activos */}
        {tieneAgendaPro && paquetes.length > 0
          ? paquetes.map((p) => (
              <Card key={p.id}>
                <View style={{ gap: tokens.space["2"] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Texto tamano={tokens.size.body} color={tokens.color.accent2Ramp["800"]} peso="semibold">
                      {formatearFolio("PACK", p.folio) ? `${formatearFolio("PACK", p.folio)} · ` : ""}
                      {p.nombre}
                    </Texto>
                    <Texto tamano={tokens.size.body} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ fontVariant: ["tabular-nums"] }}>
                      quedan {p.saldo} de {p.cantidad_total}
                    </Texto>
                  </View>
                  <View style={{ flexDirection: "row", gap: 3 }}>
                    {Array.from({ length: p.cantidad_total }).map((_, i) => (
                      <View key={i} style={{ flex: 1, height: 5, borderRadius: 2, backgroundColor: i < p.saldo ? tokens.color.accent2Ramp["700"] : tokens.color.accent2Ramp["200"] }} />
                    ))}
                  </View>
                </View>
              </Card>
            ))
          : null}
        {tieneAgendaPro && esGestion ? (
          <Pressable onPress={() => setAsignando(true)}>
            <Texto tamano={tokens.size.small} color={marca.base} peso="semibold">
              ＋ Asignar pack
            </Texto>
          </Pressable>
        ) : null}

        {/* Historial de OS */}
        {cliente.trabajos.length > 0 ? (
          <View style={{ gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Órdenes de servicio
            </Texto>
            <ListRowGrupo>
              {cliente.trabajos.slice(0, 8).map((tr) => (
                <ListRow
                  key={tr.id}
                  icono={<HardHat size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                  titulo={tr.orden?.folio != null ? `OS N° ${tr.orden.folio}` : tr.descripcion ?? "Orden de servicio"}
                  subtitulo={tr.fecha}
                  trailing={
                    tr.orden?.estado_os ? (
                      <StatusBadge estado={tr.orden.estado_os} etiqueta={ETIQUETA_OS[tr.orden.estado_os] ?? tr.orden.estado_os} />
                    ) : undefined
                  }
                  onPress={() =>
                    (navigation.getParent() as unknown as { navigate: (t: string, p: unknown) => void } | undefined)?.navigate("Hoy", {
                      screen: "Trabajos",
                      params: { screen: "TrabajoDetalle", params: { trabajoId: tr.id } },
                    })
                  }
                />
              ))}
            </ListRowGrupo>
          </View>
        ) : null}

        {/* Historial de cobros: facturas + ventas pagadas */}
        {cliente.facturas.length > 0 || ventas.length > 0 ? (
          <View style={{ gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Cobros
            </Texto>
            <ListRowGrupo>
              {cliente.facturas.slice(0, 8).map((f) => (
                <ListRow
                  key={f.id}
                  icono={<Banknote size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                  titulo={formatearFolio("COB", f.folio) ? `${formatearFolio("COB", f.folio)} · ${pesos(f.monto)}` : pesos(f.monto)}
                  subtitulo={f.fecha_emision}
                  trailing={<StatusBadge estado={f.estado} tonoForzado={f.estado === "pendiente" ? "en_progreso" : undefined} />}
                />
              ))}
              {ventas.map((v) => (
                <ListRow
                  key={v.id}
                  icono={<Receipt size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                  titulo={pesos(v.total)}
                  subtitulo={v.pagada_en.slice(0, 10)}
                  trailing={<StatusBadge estado="pagada" etiqueta="Venta" />}
                />
              ))}
            </ListRowGrupo>
          </View>
        ) : null}

        {cliente.notas ? (
          <View style={{ backgroundColor: tokens.color.neutral["200"], borderRadius: tokens.radius.md, padding: tokens.space["4"], gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
              Notas
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text}>
              {cliente.notas}
            </Texto>
          </View>
        ) : null}

        {esGestion ? (
          <View style={{ gap: tokens.space["2"], borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["4"] }}>
            <Button variante="secundario" bloque onPress={() => navigation.navigate("ClienteForm", { clienteId })}>
              Editar ficha
            </Button>
            <Button variante={cliente.activo ? "peligro" : "primario"} bloque onPress={alternarActivo} cargando={ocupado}>
              {cliente.activo ? "Marcar como inactivo" : "Reactivar cliente"}
            </Button>
          </View>
        ) : null}
      </ScrollView>

      {/* Pie */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: tokens.color.surface, borderTopWidth: 1, borderTopColor: tokens.color.divider, padding: tokens.space["4"] }}>
        <Button bloque onPress={registrarVenta}>
          Registrar venta
        </Button>
      </View>

      <AsignarPackModal
        visible={asignando}
        clienteId={clienteId}
        onCerrar={() => setAsignando(false)}
        onAsignado={() => {
          setAsignando(false);
          cargar();
        }}
      />
    </View>
  );
}
