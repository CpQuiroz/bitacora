import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, ChevronRight, Mail, MessageCircle, Phone } from "lucide-react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { PaqueteSesionesConSaldo, Servicio, TipoPack } from "@bitacora/shared";
import { grupoDeEstadoTarea } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, ScreenHeader, Texto, useMarca } from "@bitacora/ui/native";
import { formatearMoneda } from "../../lib/plata";
import { formatearDuracion, formatearFechaCompleta, formatearFechaCorta, formatearFechaLarga, sumarMinutos } from "../../lib/horario";
import { listarPaquetesCliente } from "../../services/paquetes";
import { listarServicios } from "../../services/servicios";
import { listarTiposPack } from "../../services/tiposPack";
import type { TareaConDatos } from "../../services/agenda";
import { EstadoCitaRiel } from "./EstadoCitaRiel";
import type { AgendaStackParamList } from "../../shell/navigation/types";

function soloDigitos(tel: string): string {
  return tel.replace(/[^\d]/g, "");
}

/**
 * Detalle de reserva — tema "Vino y eucalipto" (cosmetología). Reemplaza
 * el layout de TareaDetalleScreen SOLO para este rubro; el resto sigue
 * viendo la pantalla genérica. Orden pedido: bloque de foco → Atiende →
 * Cliente → Pack → Estado → pie de acciones.
 *
 * Sistema visual móvil v2 (14-sep-2026) — ScreenHeader propio con
 * `accion`=volver (antetítulo = fecha, título = cliente/servicio); el
 * bloque de foco pasa de un fondo oscuro fijo a `marca.base` (mismo
 * criterio que el bloque "SALDO POR COBRAR" de ClienteDetalleScreen).
 */
export function DetalleReservaCosmetologia({
  tarea,
  esGestion,
  enviando,
  eliminando,
  navigation,
  onConfirmar,
  onAsistio,
  onNoAsistio,
  onCancelar,
  onEditar,
  onEliminar,
}: {
  tarea: TareaConDatos;
  esGestion: boolean;
  enviando: boolean;
  eliminando: boolean;
  navigation: NativeStackNavigationProp<AgendaStackParamList, "TareaDetalle">;
  onConfirmar: () => void;
  onAsistio: () => void;
  onNoAsistio: () => void;
  onCancelar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const marca = useMarca();
  const cli = tarea.cliente;
  const grupo = grupoDeEstadoTarea(tarea.estado);
  const activa = grupo === "camino";

  const [paquete, setPaquete] = useState<PaqueteSesionesConSaldo | null>(null);
  const [tipoPack, setTipoPack] = useState<TipoPack | null>(null);
  const [servicio, setServicio] = useState<Servicio | null>(null);

  useEffect(() => {
    if (tarea.servicio_id) {
      listarServicios(false).then((ss) => setServicio(ss.find((s) => s.id === tarea.servicio_id) ?? null));
    } else {
      setServicio(null);
    }
  }, [tarea.servicio_id]);

  useEffect(() => {
    if (tarea.paquete_id && tarea.cliente_id) {
      listarPaquetesCliente(tarea.cliente_id).then((ps) => setPaquete(ps.find((p) => p.id === tarea.paquete_id) ?? null));
    } else {
      setPaquete(null);
    }
  }, [tarea.paquete_id, tarea.cliente_id]);

  useEffect(() => {
    if (paquete?.tipo_pack_id) {
      listarTiposPack(false).then((tp) => setTipoPack(tp.find((x) => x.id === paquete.tipo_pack_id) ?? null));
    } else {
      setTipoPack(null);
    }
  }, [paquete?.tipo_pack_id]);

  const horaFin = tarea.hora && tarea.duracion_min ? sumarMinutos(tarea.hora.slice(0, 5), tarea.duracion_min) : null;
  // Valor por sesión con pack = precio total del tipo / cantidad de
  // sesiones — solo si el pack salió de un tipo de catálogo (uno
  // "personalizado" no tiene ese desglose, ver Punto 5).
  const valorConPack = tipoPack?.precio != null ? tipoPack.precio / tipoPack.cantidad_sesiones : null;

  function abrirClienteFicha() {
    if (!cli) return;
    // Cross-stack (Agenda → Clientes) — la app no tiene un navigator
    // raíz compartido tipado para esto, se resuelve vía el padre.
    (navigation.getParent() as unknown as { navigate: (tab: string, params: unknown) => void } | undefined)?.navigate("Clientes", {
      screen: "ClienteDetalle",
      params: { clienteId: cli.id },
    });
  }

  // Pie de acciones: qué hace la primaria y cómo se ve, todo derivado de
  // paquete_id + estado — nunca un texto fijo que se pueda desincronizar.
  const tienePack = Boolean(tarea.paquete_id);
  const yaResuelta = tarea.estado === "completada";
  const tituloPrimaria = tienePack ? (yaResuelta ? "Sesión descontada" : "Usar sesión del pack") : yaResuelta ? "Venta registrada" : "Registrar venta";

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo={formatearFechaLarga(tarea.fecha)} titulo={cli?.nombre ?? servicio?.nombre ?? "Reserva"} accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 1.5 }}>
        {/* Bloque de foco — lo único con fondo */}
        <View style={{ backgroundColor: marca.base, borderRadius: 32, padding: tokens.space["6"], gap: tokens.space["1"] }}>
          <Texto tamano={tokens.size.micro} color={`${marca.foreground}b3`} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
            {formatearFechaLarga(tarea.fecha)}
          </Texto>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: tokens.space["2"], marginTop: tokens.space["1"] }}>
            <Texto tamano={46} color={marca.foreground} style={{ fontVariant: ["tabular-nums"] }}>
              {tarea.hora ? tarea.hora.slice(0, 5) : "—"}
            </Texto>
            {horaFin ? (
              <>
                <Texto tamano={28} color={marca.foreground} style={{ opacity: 0.7, marginBottom: 4 }}>
                  –
                </Texto>
                <Texto tamano={28} color={marca.foreground} style={{ marginBottom: 2, fontVariant: ["tabular-nums"] }}>
                  {horaFin}
                </Texto>
              </>
            ) : null}
          </View>
          {tarea.duracion_min ? (
            <Texto tamano={16} color={`${marca.foreground}cc`} style={{ marginTop: tokens.space["1"] }}>
              {formatearDuracion(tarea.duracion_min)}
            </Texto>
          ) : null}

          {servicio ? (
            <View style={{ marginTop: tokens.space["3"], paddingTop: tokens.space["3"], borderTopWidth: 1, borderTopColor: `${marca.foreground}26` }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Texto tamano={tokens.size.body} color={marca.foreground} peso="semibold">
                  {servicio.nombre}
                </Texto>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: tokens.space["1"] * 1.5 }}>
                  {tienePack && servicio.precio > 0 ? (
                    <Texto tamano={13} color={`${marca.foreground}cc`} style={{ textDecorationLine: "line-through", fontVariant: ["tabular-nums"] }}>
                      {formatearMoneda(servicio.precio)}
                    </Texto>
                  ) : null}
                  <Texto tamano={22} color={marca.foreground} style={{ fontVariant: ["tabular-nums"] }}>
                    {tienePack ? (valorConPack != null ? formatearMoneda(valorConPack) : "Con pack") : formatearMoneda(servicio.precio)}
                  </Texto>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* Adicionales */}
        {tarea.adicionales && tarea.adicionales.length > 0 ? (
          <View style={{ gap: tokens.space["1"] * 1.5, borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["3"] }}>
            <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
              Adicionales
            </Texto>
            {tarea.adicionales.map((a, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Texto tamano={tokens.size.body} color={tokens.color.text}>
                  {a.concepto}
                </Texto>
                <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                  {formatearMoneda(a.monto)}
                </Texto>
              </View>
            ))}
          </View>
        ) : null}

        {/* Atiende */}
        <View style={{ gap: tokens.space["1"] }}>
          <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
            Atiende
          </Texto>
          <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text}>
            {tarea.responsable?.nombre ?? "Sin asignar"}
          </Texto>
        </View>

        {/* Cliente */}
        {cli ? (
          <View style={{ gap: tokens.space["3"], borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["3"] }}>
            <Pressable onPress={abrirClienteFicha} style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"] }}>
              <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text} style={{ flex: 1 }}>
                {cli.nombre}
              </Texto>
              <ChevronRight size={18} strokeWidth={2.25} color={`${tokens.color.text}66`} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: tokens.space["2"] * 1.25, flexWrap: "wrap" }}>
              {cli.telefono ? (
                <Button variante="secundario" iconoIzq={<Phone size={16} strokeWidth={2.5} color={tokens.color.text} />} onPress={() => Linking.openURL(`tel:${cli.telefono}`)}>
                  Llamar
                </Button>
              ) : null}
              {cli.correo ? (
                <Button variante="secundario" iconoIzq={<Mail size={16} strokeWidth={2.5} color={tokens.color.text} />} onPress={() => Linking.openURL(`mailto:${cli.correo}`)}>
                  Correo
                </Button>
              ) : null}
              {cli.telefono ? (
                <Button
                  variante="secundario"
                  iconoIzq={<MessageCircle size={16} strokeWidth={2.5} color={tokens.color.accent2Ramp["700"]} />}
                  onPress={() => Linking.openURL(`https://wa.me/${soloDigitos(cli.telefono!)}`)}
                >
                  WhatsApp
                </Button>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Pack */}
        {paquete ? (
          <View style={{ gap: tokens.space["2"], borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["3"] }}>
            <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
              Pack
            </Texto>
            <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text}>
              {paquete.nombre}
            </Texto>
            <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.accent2Ramp["700"]} style={{ fontVariant: ["tabular-nums"] }}>
              Quedan {paquete.saldo} de {paquete.cantidad_total}
            </Texto>
            <View style={{ flexDirection: "row", gap: 3 }}>
              {Array.from({ length: paquete.cantidad_total }, (_, i) => {
                const consumido = i >= paquete.saldo;
                return (
                  <View
                    key={i}
                    style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: consumido ? tokens.color.divider : tokens.color.accent2Ramp["700"] }}
                  />
                );
              })}
            </View>
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
              Pagado el {formatearFechaCorta(paquete.fecha_compra)}
              {paquete.vence_el ? ` · vence el ${formatearFechaCompleta(paquete.vence_el)}` : ""}
            </Texto>
          </View>
        ) : null}

        {/* Estado */}
        <View style={{ borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["3"] }}>
          <EstadoCitaRiel
            estado={tarea.estado}
            activa={activa}
            cargando={enviando}
            onConfirmar={tarea.estado === "pendiente" ? onConfirmar : undefined}
            onNoAsistio={onNoAsistio}
            onCancelar={onCancelar}
          />
        </View>

        {esGestion ? (
          <View style={{ gap: tokens.space["2"] * 1.25, marginTop: tokens.space["2"], borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["4"] }}>
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
              Gestión
            </Texto>
            <Button variante="secundario" onPress={onEditar}>
              Editar / reprogramar
            </Button>
            <Button variante="peligro" onPress={onEliminar} cargando={eliminando}>
              Eliminar cita
            </Button>
          </View>
        ) : null}
      </ScrollView>

      {/* Pie de acciones */}
      {grupo === "camino" ? (
        <View style={{ padding: tokens.space["4"], paddingBottom: tokens.space["6"], borderTopWidth: 1, borderTopColor: tokens.color.divider, backgroundColor: tokens.color.surface, gap: tokens.space["2"] }}>
          <Button tamano="lg" bloque onPress={onAsistio} deshabilitado={yaResuelta} cargando={enviando}>
            {tituloPrimaria}
          </Button>
          {activa ? (
            <Pressable onPress={onCancelar} style={{ alignItems: "center", paddingVertical: tokens.space["2"] }}>
              <Texto tamano={tokens.size.body} peso="semibold" color={marca.base}>
                Cancelar reserva
              </Texto>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
