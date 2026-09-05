import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { EstadoTarea, PaqueteSesionesConSaldo, Servicio, TipoPack } from "@bitacora/shared";
import { grupoDeEstadoTarea } from "@bitacora/shared";
import { useTema } from "../../theme";
import { textoSobreFoco } from "../../theme/temas/cosmetologia";
import { Button, Text } from "../../components/ui";
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
  const t = useTema();
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

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(6) }}>
        {/* Bloque de foco — lo único con fondo */}
        <View style={{ backgroundColor: t.colores.foreground, borderRadius: t.radio.xl, padding: t.espacio(5), gap: t.espacio(1) }}>
          <Text variante="etiqueta" tono="inverso" style={{ opacity: 0.85 }}>
            {formatearFechaLarga(tarea.fecha)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: t.espacio(2), marginTop: t.espacio(1) }}>
            <Text variante="cifra" tono="inverso" style={{ fontSize: 46, lineHeight: 50 }}>
              {tarea.hora ? tarea.hora.slice(0, 5) : "—"}
            </Text>
            {horaFin ? (
              <>
                <Text variante="cifra" tono="inverso" style={{ fontSize: 28, opacity: 0.7, marginBottom: 4 }}>
                  –
                </Text>
                <Text variante="cifra" tono="inverso" style={{ fontSize: 28, marginBottom: 2 }}>
                  {horaFin}
                </Text>
              </>
            ) : null}
          </View>
          {tarea.duracion_min ? (
            <Text style={{ fontSize: 16, color: textoSobreFoco, marginTop: t.espacio(1) }}>{formatearDuracion(tarea.duracion_min)}</Text>
          ) : null}

          {servicio ? (
            <View style={{ marginTop: t.espacio(3), paddingTop: t.espacio(3), borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text tono="inverso" weight="semibold">
                  {servicio.nombre}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: t.espacio(1.5) }}>
                  {tienePack && servicio.precio > 0 ? (
                    <Text style={{ color: textoSobreFoco, textDecorationLine: "line-through", fontSize: 13 }}>
                      {formatearMoneda(servicio.precio)}
                    </Text>
                  ) : null}
                  <Text variante="cifra" tono="inverso" style={{ fontSize: 22 }}>
                    {tienePack ? (valorConPack != null ? formatearMoneda(valorConPack) : "Con pack") : formatearMoneda(servicio.precio)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* Atiende */}
        <View style={{ gap: t.espacio(1) }}>
          <Text variante="etiqueta" tono="muted">
            Atiende
          </Text>
          <Text variante="subtitulo">{tarea.responsable?.nombre ?? "Sin asignar"}</Text>
        </View>

        {/* Cliente */}
        {cli ? (
          <View style={{ gap: t.espacio(3), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(3) }}>
            <Pressable onPress={abrirClienteFicha} style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
              <Text variante="subtitulo" style={{ flex: 1 }}>
                {cli.nombre}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={t.colores.faint} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
              {cli.telefono ? (
                <Button
                  titulo="Llamar"
                  variante="secundario"
                  tamano="md"
                  icono={<Ionicons name="call-outline" size={16} color={t.colores.foreground} />}
                  onPress={() => Linking.openURL(`tel:${cli.telefono}`)}
                />
              ) : null}
              {cli.correo ? (
                <Button
                  titulo="Correo"
                  variante="secundario"
                  tamano="md"
                  icono={<Ionicons name="mail-outline" size={16} color={t.colores.foreground} />}
                  onPress={() => Linking.openURL(`mailto:${cli.correo}`)}
                />
              ) : null}
              {cli.telefono ? (
                <Button
                  titulo="WhatsApp"
                  variante="acento"
                  tamano="md"
                  icono={<Ionicons name="logo-whatsapp" size={16} color={t.colores.brandForeground} />}
                  onPress={() => Linking.openURL(`https://wa.me/${soloDigitos(cli.telefono!)}`)}
                  style={{ backgroundColor: t.colores.success }}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Pack */}
        {paquete ? (
          <View style={{ gap: t.espacio(2), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(3) }}>
            <Text variante="etiqueta" tono="muted">
              Pack
            </Text>
            <Text variante="subtitulo">{paquete.nombre}</Text>
            <Text tono="success" weight="bold">
              Quedan {paquete.saldo} de {paquete.cantidad_total}
            </Text>
            <View style={{ flexDirection: "row", gap: 3 }}>
              {Array.from({ length: paquete.cantidad_total }, (_, i) => {
                const consumido = i >= paquete.saldo;
                return (
                  <View
                    key={i}
                    style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: consumido ? t.colores.border : t.colores.success }}
                  />
                );
              })}
            </View>
            <Text variante="caption" tono="muted">
              Pagado el {formatearFechaCorta(paquete.fecha_compra)}
              {paquete.vence_el ? ` · vence el ${formatearFechaCompleta(paquete.vence_el)}` : ""}
            </Text>
          </View>
        ) : null}

        {/* Estado */}
        <View style={{ borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(3) }}>
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
          <View style={{ gap: t.espacio(2.5), marginTop: t.espacio(2), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(4) }}>
            <Text variante="caption" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Gestión
            </Text>
            <Button titulo="Editar / reprogramar" variante="secundario" onPress={onEditar} />
            <Button titulo="Eliminar cita" variante="peligro" onPress={onEliminar} cargando={eliminando} />
          </View>
        ) : null}
      </ScrollView>

      {/* Pie de acciones */}
      {grupo === "camino" ? (
        <View style={{ padding: t.espacio(4), paddingBottom: t.espacio(6), borderTopWidth: 1, borderTopColor: t.colores.border, backgroundColor: t.colores.surface, gap: t.espacio(2) }}>
          <Button titulo={tituloPrimaria} tamano="lg" onPress={onAsistio} disabled={yaResuelta} cargando={enviando} />
          {activa ? (
            <Pressable onPress={onCancelar} style={{ alignItems: "center", paddingVertical: t.espacio(2) }}>
              <Text weight="semibold" style={{ color: t.colores.brand }}>
                Cancelar reserva
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
