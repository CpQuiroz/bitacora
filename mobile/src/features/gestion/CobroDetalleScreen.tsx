import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { MedioPago } from "@bitacora/shared";
import { useTema } from "../../theme";
import { pesos } from "../../lib/plata";
import { Badge, Button, Card, ErrorState, Input, LoadingScreen, Text } from "../../components/ui";
import { useRed } from "../../services/sync/NetworkProvider";
import { estaVencido, marcarPagado, obtenerCobro, reabrirCobro, type CobroConCliente } from "../../services/cobros";
import type { GestionStackParamList } from "../../shell/navigation/types";

const hoyKey = () => new Date().toISOString().slice(0, 10);

const MEDIOS: { v: MedioPago; label: string }[] = [
  { v: "transferencia", label: "Transferencia" },
  { v: "efectivo", label: "Efectivo" },
  { v: "webpay", label: "Webpay" },
  { v: "flow", label: "Flow" },
  { v: "mercadopago", label: "MercadoPago" },
  { v: "otro", label: "Otro" },
];

export function CobroDetalleScreen({ route }: NativeStackScreenProps<GestionStackParamList, "CobroDetalle">) {
  const t = useTema();
  const { cobroId } = route.params;
  const { enLinea } = useRed();
  const [cobro, setCobro] = useState<CobroConCliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [pagando, setPagando] = useState(false);
  const [medio, setMedio] = useState<MedioPago | "">("");
  const [valorRecibido, setValorRecibido] = useState("");
  const [obs, setObs] = useState("");

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setCobro(await obtenerCobro(cobroId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el cobro");
    }
  }, [cobroId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function confirmarPago() {
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para registrar el pago.");
    setOcupado(true);
    const r = await marcarPagado(cobroId, {
      fecha_pago: hoyKey(),
      medio_pago: medio,
      valor_recibido: valorRecibido || undefined,
      observaciones_pago: obs || undefined,
    });
    setOcupado(false);
    if (!r.ok) return Alert.alert("No se pudo registrar", r.error);
    setPagando(false);
    cargar();
  }

  function reabrir() {
    Alert.alert("Reabrir el cobro", "Vuelve a quedar pendiente y se borra el registro del pago. ¿Seguro?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, reabrir",
        style: "destructive",
        onPress: async () => {
          if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para esto.");
          setOcupado(true);
          const r = await reabrirCobro(cobroId);
          setOcupado(false);
          if (!r.ok) return Alert.alert("No se pudo reabrir", r.error);
          cargar();
        },
      },
    ]);
  }

  if (!cobro && !error) return <LoadingScreen />;
  if (error && !cobro) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!cobro) return null;

  const vencido = estaVencido(cobro);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(16) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variante="titulo">{pesos(cobro.monto)}</Text>
          <Text variante="etiqueta" tono="muted">
            {cobro.cliente_info?.nombre ?? cobro.cliente}
          </Text>
        </View>
        <Badge texto={vencido ? "vencida" : cobro.estado} estado={vencido ? "vencida" : cobro.estado} />
      </View>

      <Card plano style={{ gap: t.espacio(2) }}>
        <Fila etiqueta="Emitida" valor={cobro.fecha_emision} />
        <Fila etiqueta="Vence" valor={cobro.fecha_vencimiento} />
        {cobro.fecha_pago ? <Fila etiqueta="Pagada" valor={cobro.fecha_pago} /> : null}
        {cobro.medio_pago ? <Fila etiqueta="Medio de pago" valor={cobro.medio_pago} /> : null}
        {cobro.valor_recibido != null ? <Fila etiqueta="Valor recibido" valor={pesos(cobro.valor_recibido)} /> : null}
        {cobro.observaciones_pago ? <Fila etiqueta="Observaciones" valor={cobro.observaciones_pago} /> : null}
      </Card>

      {cobro.link_pago ? (
        <Button
          titulo="Abrir link de pago"
          variante="secundario"
          icono={<Ionicons name="open-outline" size={16} color={t.colores.foreground} />}
          onPress={() => Linking.openURL(cobro.link_pago!)}
        />
      ) : null}

      {cobro.estado !== "pagada" ? (
        pagando ? (
          <Card plano style={{ gap: t.espacio(3) }}>
            <Text variante="etiqueta" weight="semibold">
              Registrar pago
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
              {MEDIOS.map((m) => {
                const activo = medio === m.v;
                return (
                  <Pressable
                    key={m.v}
                    onPress={() => setMedio(activo ? "" : m.v)}
                    style={{
                      minHeight: 36,
                      justifyContent: "center",
                      paddingHorizontal: t.espacio(3),
                      borderRadius: t.radio.md,
                      backgroundColor: activo ? t.colores.brand : t.colores.surfaceAlt,
                    }}
                  >
                    <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Input etiqueta="Valor recibido (opcional)" keyboardType="numeric" value={valorRecibido} onChangeText={setValorRecibido} />
            <Input etiqueta="Observaciones (opcional)" multiline value={obs} onChangeText={setObs} />
            <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
              <Button titulo="Confirmar pago" onPress={confirmarPago} cargando={ocupado} />
              <Button titulo="Cancelar" variante="ghost" onPress={() => setPagando(false)} />
            </View>
          </Card>
        ) : (
          <Button titulo="Marcar como pagado" tamano="lg" onPress={() => setPagando(true)} />
        )
      ) : (
        <Button titulo="Reabrir cobro" variante="peligro" onPress={reabrir} cargando={ocupado} />
      )}
    </ScrollView>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <Text variante="etiqueta" weight="medium" style={{ flexShrink: 1, textAlign: "right", textTransform: "capitalize" }}>
        {valor}
      </Text>
    </View>
  );
}
