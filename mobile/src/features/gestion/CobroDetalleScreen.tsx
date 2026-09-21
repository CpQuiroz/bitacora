import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, ExternalLink } from "lucide-react-native";
import type { MedioPago } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, ErrorState, LoadingState, ScreenHeader, StatusBadge, Textarea, Texto, useMarca } from "@bitacora/ui/native";
import { pesos } from "../../lib/plata";
import { InputMonto } from "../../components/InputMonto";
import { useRed } from "../../services/sync/NetworkProvider";
import { estaVencido, marcarPagado, obtenerCobro, reabrirCobro, type CobroConCliente } from "../../services/cobros";
import type { MasStackParamList } from "../../shell/navigation/types";

const hoyKey = () => new Date().toISOString().slice(0, 10);

const MEDIOS: { v: MedioPago; label: string }[] = [
  { v: "transferencia", label: "Transferencia" },
  { v: "efectivo", label: "Efectivo" },
  { v: "webpay", label: "Webpay" },
  { v: "flow", label: "Flow" },
  { v: "mercadopago", label: "MercadoPago" },
  { v: "otro", label: "Otro" },
];

// Sistema visual móvil v2 — pantalla push de detalle, mismo patrón que
// ClienteDetalleScreen: ScreenHeader propio con `accion` de volver
// (antetítulo = cliente, título = monto), Card genérico para agrupar
// filas de datos y para la sección de "registrar pago".
export function CobroDetalleScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "CobroDetalle">) {
  const marca = useMarca();
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

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!cobro && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Cobro" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !cobro) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Cobro" accion={volver} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }
  if (!cobro) return null;

  const vencido = estaVencido(cobro);
  const estadoMostrado = vencido ? "vencida" : cobro.estado;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        antetitulo={
          [formatearFolio("COB", cobro.folio), cobro.cliente_info?.nombre ?? cobro.cliente].filter(Boolean).join(" · ") || undefined
        }
        titulo={pesos(cobro.monto)}
        accion={volver}
      />
      <ScrollView contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 2 }}>
        <View style={{ alignSelf: "flex-start" }}>
          <StatusBadge estado={estadoMostrado} tonoForzado={estadoMostrado === "pendiente" ? "en_progreso" : undefined} />
        </View>

        <Card>
          <View style={{ gap: tokens.space["2"] }}>
            <Fila etiqueta="Emitida" valor={cobro.fecha_emision} />
            <Fila etiqueta="Vence" valor={cobro.fecha_vencimiento} />
            {cobro.fecha_pago ? <Fila etiqueta="Pagada" valor={cobro.fecha_pago} /> : null}
            {cobro.medio_pago ? <Fila etiqueta="Medio de pago" valor={cobro.medio_pago} /> : null}
            {cobro.valor_recibido != null ? <Fila etiqueta="Valor recibido" valor={pesos(cobro.valor_recibido)} /> : null}
            {cobro.observaciones_pago ? <Fila etiqueta="Observaciones" valor={cobro.observaciones_pago} /> : null}
          </View>
        </Card>

        {cobro.link_pago ? (
          <Button
            variante="secundario"
            bloque
            iconoIzq={<ExternalLink size={16} strokeWidth={2.5} color={tokens.color.text} />}
            onPress={() => Linking.openURL(cobro.link_pago!)}
          >
            Abrir link de pago
          </Button>
        ) : null}

        {cobro.estado !== "pagada" ? (
          pagando ? (
            <Card>
              <View style={{ gap: tokens.space["3"] }}>
                <Texto tamano={tokens.size.small} color={tokens.color.text} peso="semibold">
                  Registrar pago
                </Texto>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
                  {MEDIOS.map((m) => {
                    const activo = medio === m.v;
                    return (
                      <Pressable
                        key={m.v}
                        onPress={() => setMedio(activo ? "" : m.v)}
                        style={{
                          minHeight: 36,
                          justifyContent: "center",
                          paddingHorizontal: tokens.space["3"],
                          borderRadius: tokens.radius.md,
                          backgroundColor: activo ? marca.suave : tokens.color.surface,
                        }}
                      >
                        <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : `${tokens.color.text}99`}>
                          {m.label}
                        </Texto>
                      </Pressable>
                    );
                  })}
                </View>
                <InputMonto etiqueta="Valor recibido (opcional)" valor={valorRecibido} onChangeText={setValorRecibido} />
                <Textarea etiqueta="Observaciones (opcional)" valor={obs} onCambio={setObs} filas={3} />
                <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
                  <Button onPress={confirmarPago} cargando={ocupado}>
                    Confirmar pago
                  </Button>
                  <Button variante="ghost" onPress={() => setPagando(false)}>
                    Cancelar
                  </Button>
                </View>
              </View>
            </Card>
          ) : (
            <Button tamano="lg" bloque onPress={() => setPagando(true)}>
              Marcar como pagado
            </Button>
          )
        ) : (
          <Button variante="peligro" bloque onPress={reabrir} cargando={ocupado}>
            Reabrir cobro
          </Button>
        )}
      </ScrollView>
    </View>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.space["3"] }}>
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
        {etiqueta}
      </Texto>
      <Texto tamano={tokens.size.small} peso="medium" color={tokens.color.text} style={{ flexShrink: 1, textAlign: "right", textTransform: "capitalize" }}>
        {valor}
      </Texto>
    </View>
  );
}
