import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Linking, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { EstadoViaje } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Button, Card, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { aprobarViaje, obtenerViaje, rechazarViaje, type ViajeDetalle } from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

const NOTA_ESTADO: Record<EstadoViaje, string> = {
  borrador: "La oficina todavía no lo revisa.",
  confirmado: "Revisado y confirmado por la oficina.",
  facturado: "Facturado al cliente.",
};

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

function abrirEnMapa(app: "google" | "waze", origen: string, destino: string) {
  const o = encodeURIComponent(origen);
  const d = encodeURIComponent(destino);
  const url =
    app === "waze"
      ? `https://waze.com/ul?q=${d}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`;
  Linking.openURL(url).catch(() => Alert.alert("No se pudo abrir", "Revisa que tengas la app instalada."));
}

export function ViajeDetalleScreen({ route, navigation }: NativeStackScreenProps<ViajesStackParamList, "ViajeDetalle">) {
  const t = useTema();
  const { viajeId } = route.params;
  const { enLinea } = useRed();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const [viaje, setViaje] = useState<ViajeDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await obtenerViaje(viajeId);
      setViaje(r.viaje);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el viaje");
    }
  }, [viajeId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function aprobar() {
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para aprobar un viaje.");
    setOcupado(true);
    const r = await aprobarViaje(viajeId);
    setOcupado(false);
    if (!r.ok) return Alert.alert("No se pudo aprobar", r.error ?? "Intenta de nuevo.");
    cargar();
  }

  function rechazar() {
    Alert.alert("Rechazar el viaje", "Se elimina de la lista. El chofer tendrá que registrarlo de nuevo si corresponde.", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, rechazar",
        style: "destructive",
        onPress: async () => {
          if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para rechazar un viaje.");
          setOcupado(true);
          const r = await rechazarViaje(viajeId);
          setOcupado(false);
          if (!r.ok) return Alert.alert("No se pudo rechazar", r.error ?? "Intenta de nuevo.");
          navigation.goBack();
        },
      },
    ]);
  }

  if (!viaje && !error) return <LoadingScreen />;
  if (error && !viaje) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!viaje) return null;

  const kmRecorridos =
    viaje.km_inicial != null && viaje.km_final != null ? viaje.km_final - viaje.km_inicial : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(16) }}>
        <View style={{ gap: t.espacio(1.5) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: t.espacio(3) }}>
            <Text variante="titulo" style={{ flex: 1 }}>
              {viaje.cliente_info?.nombre ?? viaje.cliente}
            </Text>
            <Badge estado={viaje.estado} />
          </View>
          <Text variante="etiqueta" tono="muted">
            {viaje.fecha} · Guía {viaje.numero_guia}
          </Text>
          {esGestion && viaje.chofer?.nombre ? (
            <Text variante="etiqueta" tono="muted">
              Chofer: {viaje.chofer.nombre}
            </Text>
          ) : null}
          <Text variante="caption" tono="muted">
            {NOTA_ESTADO[viaje.estado]}
          </Text>
        </View>

        <Card plano style={{ gap: t.espacio(2) }}>
          <Fila etiqueta="Origen" valor={viaje.origen} />
          <Fila etiqueta="Destino" valor={viaje.destino} />
          {viaje.equipo_info ? (
            <Fila
              etiqueta="Vehículo"
              valor={`${viaje.equipo_info.nombre}${viaje.equipo_info.patente ? ` · ${viaje.equipo_info.patente}` : ""}`}
            />
          ) : null}
          {viaje.km_inicial != null ? <Fila etiqueta="Km inicial" valor={String(viaje.km_inicial)} /> : null}
          {viaje.km_final != null ? <Fila etiqueta="Km final" valor={String(viaje.km_final)} /> : null}
          {kmRecorridos != null ? <Fila etiqueta="Km recorridos" valor={String(kmRecorridos)} /> : null}
          <View style={{ flexDirection: "row", gap: t.espacio(2.5), marginTop: t.espacio(1) }}>
            <Button
              titulo="Google Maps"
              variante="secundario"
              icono={<Ionicons name="map-outline" size={16} color={t.colores.foreground} />}
              onPress={() => abrirEnMapa("google", viaje.origen, viaje.destino)}
            />
            <Button
              titulo="Waze"
              variante="secundario"
              icono={<Ionicons name="navigate-outline" size={16} color={t.colores.foreground} />}
              onPress={() => abrirEnMapa("waze", viaje.origen, viaje.destino)}
            />
          </View>
        </Card>

        <Card plano style={{ gap: t.espacio(2) }}>
          <Fila etiqueta="Monto (sin IVA)" valor={pesos(viaje.subtotal)} />
          {viaje.aplica_iva ? <Fila etiqueta="IVA (19%)" valor={pesos(viaje.iva)} /> : null}
          <Fila etiqueta="Total" valor={pesos(viaje.total)} destacado />
        </Card>

        {viaje.comentarios ? (
          <Card plano style={{ gap: t.espacio(1.5) }}>
            <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Comentarios de la oficina
            </Text>
            <Text variante="cuerpo">{viaje.comentarios}</Text>
          </Card>
        ) : null}

        {viaje.foto_guia_url_firmada ? (
          <Card plano style={{ gap: t.espacio(2) }}>
            <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Foto de la guía
            </Text>
            <Image
              source={{ uri: viaje.foto_guia_url_firmada }}
              style={{ width: "100%", height: 260, borderRadius: t.radio.sm }}
              resizeMode="cover"
            />
          </Card>
        ) : null}

        {esGestion && viaje.estado !== "facturado" ? (
          <View style={{ gap: t.espacio(2.5), marginTop: t.espacio(1), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(4) }}>
            <Text variante="caption" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Gestión
            </Text>
            {viaje.estado === "borrador" ? (
              <Button titulo="Aprobar viaje" tamano="lg" onPress={aprobar} cargando={ocupado} />
            ) : null}
            <Button
              titulo="Editar"
              variante="secundario"
              icono={<Ionicons name="create-outline" size={16} color={t.colores.foreground} />}
              onPress={() => navigation.navigate("ViajeForm", { viajeId })}
            />
            {viaje.estado === "borrador" ? (
              <Button titulo="Rechazar viaje" variante="peligro" onPress={rechazar} cargando={ocupado} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Fila({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: t.espacio(3) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <Text variante={destacado ? "subtitulo" : "etiqueta"} weight={destacado ? "semibold" : "medium"} style={{ flexShrink: 1, textAlign: "right" }}>
        {valor}
      </Text>
    </View>
  );
}
