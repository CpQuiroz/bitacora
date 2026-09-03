import { useCallback, useEffect, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoViaje } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Card, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { obtenerViaje, type ViajeDetalle } from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

const NOTA_ESTADO: Record<EstadoViaje, string> = {
  borrador: "La oficina todavía no lo revisa.",
  confirmado: "Revisado y confirmado por la oficina.",
  facturado: "Facturado al cliente.",
};

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

export function ViajeDetalleScreen({ route }: NativeStackScreenProps<ViajesStackParamList, "ViajeDetalle">) {
  const t = useTema();
  const { viajeId } = route.params;
  const [viaje, setViaje] = useState<ViajeDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

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
