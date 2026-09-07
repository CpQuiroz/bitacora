import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { PaqueteSesionesConSaldo, VentaConLineas } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Button, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { editarCliente, obtenerClienteDetalle, saldoDeFacturas, type ClienteDetalle } from "../../services/clientes";
import { listarPaquetesCliente } from "../../services/paquetes";
import { ventasDeCliente } from "../../services/ventas";
import { pesos } from "../../lib/plata";
import { AsignarPackModal } from "./AsignarPackModal";
import type { ClientesStackParamList } from "../../shell/navigation/types";

const soloDigitos = (s: string) => s.replace(/[^\d]/g, "");

export function ClienteDetalleScreen({ route, navigation }: NativeStackScreenProps<ClientesStackParamList, "ClienteDetalle">) {
  const t = useTema();
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
      activo: !cliente.activo,
    });
    setOcupado(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
    cargar();
  }

  if (!cliente && !error) return <LoadingScreen />;
  if (error && !cliente) return <ErrorState mensaje={error} onReintentar={cargar} />;
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
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(20) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
          <Text variante="titulo" style={{ flex: 1 }}>
            {cliente.nombre}
          </Text>
          {!cliente.activo ? <Badge texto="inactivo" estado="cancelado" /> : null}
        </View>

        {/* Bloque de foco navy — SALDO POR COBRAR */}
        <View style={{ backgroundColor: t.colores.brand, borderRadius: t.radio.lg, padding: t.espacio(5), gap: t.espacio(3) }}>
          <Text variante="caption" style={{ color: t.colores.brandSoft, letterSpacing: 1.2 }}>
            SALDO POR COBRAR
          </Text>
          <Text variante="cifra" tono="inverso" style={{ fontSize: 30 }}>
            {pesos(saldo.porCobrar)}
          </Text>
          <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: t.espacio(3) }}>
            <Text mono variante="caption" style={{ color: t.colores.brandSoft }}>
              {saldo.vencido > 0 ? `${pesos(saldo.vencido)} vencido` : "Nada vencido"}
              {"  ·  "}
              {saldo.documentos} {saldo.documentos === 1 ? "documento" : "documentos"}
            </Text>
          </View>
        </View>

        {/* Contacto */}
        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
          {cliente.telefono ? (
            <Button titulo="Llamar" variante="secundario" style={{ flex: 1 }} icono={<Ionicons name="call-outline" size={16} color={t.colores.foreground} />} onPress={() => Linking.openURL(`tel:${cliente.telefono}`)} />
          ) : null}
          {cliente.correo ? (
            <Button titulo="Correo" variante="secundario" style={{ flex: 1 }} icono={<Ionicons name="mail-outline" size={16} color={t.colores.foreground} />} onPress={() => Linking.openURL(`mailto:${cliente.correo}`)} />
          ) : null}
          {cliente.telefono ? (
            <Button
              titulo="WhatsApp"
              variante="secundario"
              style={{ flex: 1 }}
              icono={<Ionicons name="logo-whatsapp" size={16} color={t.colores.success} />}
              onPress={() => Linking.openURL(`https://wa.me/${soloDigitos(cliente.telefono!)}`)}
            />
          ) : null}
        </View>

        {/* Packs activos */}
        {tieneAgendaPro && paquetes.length > 0
          ? paquetes.map((p) => (
              <View key={p.id} style={{ backgroundColor: t.colores.successSoft, borderRadius: t.radio.md, padding: t.espacio(4), gap: t.espacio(2) }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text weight="semibold" style={{ color: t.colores.success }}>
                    {p.nombre}
                  </Text>
                  <Text mono weight="semibold" style={{ color: t.colores.success }}>
                    quedan {p.saldo} de {p.cantidad_total}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 3 }}>
                  {Array.from({ length: p.cantidad_total }).map((_, i) => (
                    <View key={i} style={{ flex: 1, height: 5, borderRadius: 2, backgroundColor: i < p.saldo ? t.colores.success : "rgba(20,102,60,0.25)" }} />
                  ))}
                </View>
              </View>
            ))
          : null}
        {tieneAgendaPro && esGestion ? (
          <Pressable onPress={() => setAsignando(true)}>
            <Text variante="caption" weight="semibold" tono="brand">
              ＋ Asignar pack
            </Text>
          </Pressable>
        ) : null}

        {/* Historial de OS */}
        {cliente.trabajos.length > 0 ? (
          <View style={{ gap: t.espacio(2) }}>
            <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Órdenes de servicio
            </Text>
            {cliente.trabajos.slice(0, 8).map((tr) => (
              <Pressable
                key={tr.id}
                onPress={() =>
                  (navigation.getParent() as unknown as { navigate: (t: string, p: unknown) => void } | undefined)?.navigate("Hoy", {
                    screen: "Trabajos",
                    params: { screen: "TrabajoDetalle", params: { trabajoId: tr.id } },
                  })
                }
                style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3), paddingVertical: t.espacio(2.5), borderBottomWidth: 1, borderBottomColor: t.colores.border }}
              >
                <Text mono variante="caption" tono="muted" style={{ width: 74 }}>
                  {tr.fecha}
                </Text>
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {tr.orden?.folio != null ? `OS N° ${tr.orden.folio}` : tr.descripcion ?? "Trabajo"}
                </Text>
                {tr.orden?.estado_os ? <Badge estado={tr.orden.estado_os} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Historial de cobros: facturas + ventas pagadas */}
        {cliente.facturas.length > 0 || ventas.length > 0 ? (
          <View style={{ gap: t.espacio(2) }}>
            <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Cobros
            </Text>
            {cliente.facturas.slice(0, 8).map((f) => (
              <View key={f.id} style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3), paddingVertical: t.espacio(2.5), borderBottomWidth: 1, borderBottomColor: t.colores.border }}>
                <Text mono variante="caption" tono="muted" style={{ width: 74 }}>
                  {f.fecha_emision}
                </Text>
                <Text mono style={{ flex: 1 }}>
                  {pesos(f.monto)}
                </Text>
                <Badge estado={f.estado} />
              </View>
            ))}
            {ventas.map((v) => (
              <View key={v.id} style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3), paddingVertical: t.espacio(2.5), borderBottomWidth: 1, borderBottomColor: t.colores.border }}>
                <Text mono variante="caption" tono="muted" style={{ width: 74 }}>
                  {v.pagada_en.slice(0, 10)}
                </Text>
                <Text mono style={{ flex: 1 }}>
                  {pesos(v.total)}
                </Text>
                <Badge estado="pagada" texto="venta" />
              </View>
            ))}
          </View>
        ) : null}

        {cliente.notas ? (
          <View style={{ backgroundColor: t.colores.surfaceAlt, borderRadius: t.radio.md, padding: t.espacio(4), gap: t.espacio(1) }}>
            <Text variante="caption" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Notas
            </Text>
            <Text>{cliente.notas}</Text>
          </View>
        ) : null}

        {esGestion ? (
          <View style={{ gap: t.espacio(2), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(4) }}>
            <Button titulo="Editar ficha" variante="secundario" onPress={() => navigation.navigate("ClienteForm", { clienteId })} />
            <Button
              titulo={cliente.activo ? "Marcar como inactivo" : "Reactivar cliente"}
              variante={cliente.activo ? "peligro" : "primario"}
              onPress={alternarActivo}
              cargando={ocupado}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Pie */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: t.colores.surface, borderTopWidth: 1, borderTopColor: t.colores.border, padding: t.espacio(4) }}>
        <Button titulo="Registrar venta" onPress={registrarVenta} />
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
