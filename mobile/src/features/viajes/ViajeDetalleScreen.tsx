import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { EstadoViaje } from "@bitacora/shared";
import { useTema } from "../../theme";
import { pesos } from "../../lib/plata";
import { Badge, Button, Card, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { elegirFotos } from "../../lib/imagen";
import { aprobarViaje, eliminarFotoViaje, encolarFotoViaje, obtenerViaje, rechazarViaje, type ViajeDetalle } from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

const NOTA_ESTADO: Record<EstadoViaje, string> = {
  borrador: "La oficina todavía no lo revisa.",
  confirmado: "Revisado y confirmado por la oficina.",
  facturado: "Facturado al cliente.",
};


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
  const { enLinea, pendientes } = useRed();
  const auth = useAuth();

  const fotosEnCola = pendientes.filter((a) => a.recurso === `viaje:${viajeId}` && a.etiqueta === "Foto de viaje");
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const [viaje, setViaje] = useState<ViajeDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const [eliminandoFotoId, setEliminandoFotoId] = useState<string | null>(null);

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

  // Cuando una foto sale de la cola, refrescamos para traer la del servidor.
  useEffect(() => {
    void cargar();
  }, [fotosEnCola.length, cargar]);

  async function agregarFoto() {
    const [elegida] = await elegirFotos({ titulo: "Foto del viaje" });
    if (!elegida) return;
    await encolarFotoViaje(viajeId, elegida);
  }

  function confirmarEliminarFoto(fotoId: string) {
    Alert.alert("Eliminar foto", "¿Eliminar esta foto del viaje?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para eliminar una foto.");
          setEliminandoFotoId(fotoId);
          const res = await eliminarFotoViaje(viajeId, fotoId);
          setEliminandoFotoId(null);
          if (!res.ok) return Alert.alert("No se pudo eliminar", res.error);
          void cargar();
        },
      },
    ]);
  }

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
        <View
          style={{
            gap: t.espacio(1.5),
            ...(viaje.estado === "borrador" ? { borderLeftWidth: 4, borderLeftColor: t.colores.accent, paddingLeft: t.espacio(3) } : {}),
          }}
        >
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

        {/* Fotos del viaje (guía + adicionales del chofer) */}
        {(() => {
          const subidas = [
            ...(viaje.foto_guia_url_firmada ? [{ id: "guia", url: viaje.foto_guia_url_firmada }] : []),
            ...(viaje.fotos ?? []),
          ];
          const total = subidas.length + fotosEnCola.length;
          return (
            <Card plano style={{ gap: t.espacio(2.5) }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
                  Fotos del viaje
                </Text>
                {total > 0 ? (
                  <Text mono variante="caption" tono="faint">
                    {subidas.length} subida{subidas.length === 1 ? "" : "s"}
                    {fotosEnCola.length ? ` · ${fotosEnCola.length} en cola` : ""}
                  </Text>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.espacio(2) }}>
                {subidas.map((f) => (
                  <View key={f.id} style={{ width: 78, height: 78 }}>
                    <Image source={{ uri: f.url }} style={{ width: 78, height: 78, borderRadius: t.radio.sm, borderWidth: 1, borderColor: t.colores.border }} />
                    {f.id !== "guia" && viaje.estado !== "facturado" ? (
                      <Pressable
                        onPress={() => confirmarEliminarFoto(f.id)}
                        disabled={eliminandoFotoId === f.id}
                        hitSlop={8}
                        style={{
                          position: "absolute",
                          right: -6,
                          top: -6,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: t.colores.danger,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: eliminandoFotoId === f.id ? 0.6 : 1,
                        }}
                      >
                        <Ionicons name="close" size={13} color={t.colores.brandForeground} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {fotosEnCola.map((a) => (
                  <View key={a.id} style={{ width: 78, height: 78, borderRadius: t.radio.sm, backgroundColor: t.colores.surfaceAlt, borderWidth: 1, borderColor: t.colores.border, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="sync" size={16} color={t.colores.accent} />
                  </View>
                ))}
                {viaje.estado !== "facturado" ? (
                  <Pressable
                    onPress={agregarFoto}
                    style={{ width: 78, height: 78, borderRadius: t.radio.sm, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.colores.borderStrong, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="camera-outline" size={22} color={t.colores.muted} />
                  </Pressable>
                ) : null}
              </ScrollView>
              {total === 0 ? (
                <Text variante="caption" tono="muted">
                  Sin fotos todavía.
                </Text>
              ) : null}
            </Card>
          );
        })()}

        {viaje.estado !== "facturado" ? (
          <View style={{ gap: t.espacio(2.5), marginTop: t.espacio(1), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(4) }}>
            {esGestion ? (
              <Text variante="caption" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
                Gestión
              </Text>
            ) : null}
            {esGestion && viaje.estado === "borrador" ? (
              <Button titulo="Aprobar viaje" tamano="lg" onPress={aprobar} cargando={ocupado} />
            ) : null}
            <Button
              titulo="Editar"
              variante="secundario"
              icono={<Ionicons name="create-outline" size={16} color={t.colores.foreground} />}
              onPress={() => navigation.navigate("ViajeForm", { viajeId })}
            />
            {esGestion && viaje.estado === "borrador" ? (
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
