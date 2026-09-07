import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoTrabajo, ItemChecklist } from "@bitacora/shared";
import { estadoOsDeTrabajo } from "@bitacora/shared";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { Badge, Button, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { ubicacionActual } from "../../lib/geo";
import {
  encolarCheckin,
  encolarDatos,
  encolarFinalizar,
  encolarFirma,
  encolarFoto,
  obtenerDetalle,
  type DetalleTrabajo,
} from "../../services/trabajos";
import { CamposDinamicos } from "./components/CamposDinamicos";
import { FotosSection } from "./components/FotosSection";
import { CierreFirma } from "./components/CierreFirma";
import type { TrabajosStackParamList } from "../../shell/navigation/types";

const ETIQUETA_OS: Record<string, string> = {
  pendiente: "Sin empezar",
  enviada: "Sin empezar",
  en_proceso: "En proceso",
  completada: "Completado",
  firmada: "Finalizado",
  cancelada: "Cancelado",
};

function haceCuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h ${min % 60} min`;
}

function Fila({
  etiqueta,
  valor,
  onPress,
  icono,
}: {
  etiqueta: string;
  valor: string;
  onPress?: () => void;
  icono?: keyof typeof Ionicons.glyphMap;
}) {
  const t = useTema();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.espacio(3),
        paddingVertical: t.espacio(3),
        borderBottomWidth: 1,
        borderBottomColor: t.colores.border,
      }}
    >
      <Text variante="etiqueta" tono="muted" style={{ width: 92 }}>
        {etiqueta}
      </Text>
      <Text style={{ flex: 1 }}>{valor}</Text>
      {onPress ? <Ionicons name={icono ?? "chevron-forward"} size={18} color={t.colores.faint} /> : null}
    </Pressable>
  );
}

export function TrabajoDetalleScreen({ route, navigation }: NativeStackScreenProps<TrabajosStackParamList, "TrabajoDetalle">) {
  const t = useTema();
  const { trabajoId } = route.params;
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const { pendientes, fallidas, enLinea, descartar } = useRed();
  const fotosPendientes = useMemo(() => {
    const esFotoDeAca = (a: (typeof pendientes)[number]) => a.recurso === `trabajo:${trabajoId}` && a.etiqueta === "Foto";
    return [
      ...pendientes.filter(esFotoDeAca).map((a) => ({ id: a.id, uri: a.archivo?.uri ?? "", fallida: false, error: a.ultimoError })),
      ...fallidas.filter(esFotoDeAca).map((a) => ({ id: a.id, uri: a.archivo?.uri ?? "", fallida: true, error: a.ultimoError })),
    ];
  }, [pendientes, fallidas, trabajoId]);

  const [detalle, setDetalle] = useState<DetalleTrabajo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datosForm, setDatosForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [marcando, setMarcando] = useState<"Check-in" | "Check-out" | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await obtenerDetalle(trabajoId);
      setDetalle(d);
      setDatosForm(Object.fromEntries(Object.entries(d.trabajo.datos ?? {}).map(([k, v]) => [k, String(v ?? "")])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el trabajo");
    }
  }, [trabajoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  const fotosEnCola = fotosPendientes.filter((f) => !f.fallida).length;
  useEffect(() => {
    void cargar();
  }, [fotosEnCola, cargar]);

  const hayFotoProcesando = (detalle?.fotos ?? []).some((f) => f.estado === "procesando");
  useEffect(() => {
    if (!hayFotoProcesando) return;
    const id = setInterval(() => void cargar(), 8000);
    return () => clearInterval(id);
  }, [hayFotoProcesando, cargar]);

  if (!detalle && !error) return <LoadingScreen />;
  if (error && !detalle) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!detalle) return null;

  const { trabajo, orden, fotos } = detalle;
  const cli = trabajo.cliente_info;
  const finalizada = Boolean(orden?.finalizada_en) || finalizando;
  const checklist: ItemChecklist[] = orden?.checklist ?? [];
  const checkIn = checklist.find((c) => c.item === "Check-in");
  const checkOut = checklist.find((c) => c.item === "Check-out");
  const estadoOsEfectivo = orden?.estado_os ?? estadoOsDeTrabajo(trabajo.estado as EstadoTrabajo);
  const estadoMostrar = ETIQUETA_OS[estadoOsEfectivo] ?? estadoOsEfectivo;
  const direccion = cli?.direccion || trabajo.ubicacion;
  const coords = cli?.lat != null && cli?.lng != null ? { lat: cli.lat, lng: cli.lng } : null;
  const checkInAt = orden?.check_in_at ?? checkIn?.hora ?? null;

  function abrirMapa() {
    const destino = coords ? `${coords.lat},${coords.lng}` : encodeURIComponent(direccion ?? "");
    if (!destino) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${destino}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
    });
    Linking.openURL(url!);
  }

  async function marcar(item: "Check-in" | "Check-out") {
    setMarcando(item);
    const ubic = await ubicacionActual();
    if (!ubic) {
      Alert.alert("Sin ubicación", `Se registrará el ${item.toLowerCase()} sin coordenadas (permiso denegado o GPS no disponible).`);
    }
    await encolarCheckin(trabajoId, item, ubic);
    setMarcando(null);
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            orden: {
              ...(prev.orden ?? ({} as NonNullable<DetalleTrabajo["orden"]>)),
              checklist: [...(prev.orden?.checklist ?? []).filter((c) => c.item !== item), { item, hecho: true, hora: new Date().toISOString() }],
              ...(item === "Check-in" && ubic
                ? { check_in_at: new Date().toISOString(), check_in_lat: ubic.lat, check_in_lng: ubic.lng, check_in_precision: ubic.precision_m }
                : {}),
            } as DetalleTrabajo["orden"],
          }
        : prev
    );
  }

  async function guardarDatos() {
    setGuardandoDatos(true);
    await encolarDatos(trabajoId, datosForm);
    setGuardandoDatos(false);
    Alert.alert("Guardado", enLinea ? "Datos guardados." : "Se enviarán cuando haya conexión.");
  }

  async function finalizar() {
    setFinalizando(true);
    await encolarFinalizar(trabajoId);
    Alert.alert("Trabajo finalizado", "Quedó cerrado. Si estás sin conexión, se enviará a la oficina apenas vuelvas a tener señal.", [
      { text: "Listo", onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={detalle.desdeCache ? detalle.guardadoEn : undefined} />
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(24) }}>
        {/* Cabecera: folio + cliente */}
        <View style={{ gap: t.espacio(1) }}>
          {orden?.folio != null ? (
            <Text mono variante="caption" tono="muted">
              OS N° {orden.folio}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: t.espacio(2) }}>
            <Text variante="titulo" style={{ flex: 1 }}>
              {cli?.nombre ?? trabajo.cliente}
            </Text>
            <Badge texto={estadoMostrar} estado={estadoOsEfectivo} />
          </View>
          <Text mono variante="caption" tono="muted">
            {trabajo.fecha}
            {trabajo.hora_programada ? ` · ${trabajo.hora_programada.slice(0, 5)}` : ""}
          </Text>
          {esGestion ? (
            <Pressable onPress={() => navigation.navigate("TrabajoForm", { trabajoId })} style={{ marginTop: t.espacio(1) }}>
              <Text variante="etiqueta" tono="brand" weight="semibold">
                Editar datos
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Bloque de foco — lo único con fondo navy */}
        <View style={{ backgroundColor: t.colores.brand, borderRadius: t.radio.lg, padding: t.espacio(5), gap: t.espacio(3) }}>
          {checkInAt ? (
            <>
              <Text variante="caption" style={{ color: t.colores.brandSoft, letterSpacing: 1.2 }}>
                CHECK-IN REGISTRADO
              </Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: t.espacio(3) }}>
                <Text variante="cifra" tono="inverso" style={{ fontSize: 30 }}>
                  {new Date(checkInAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <Text style={{ color: t.colores.brandSoft }}>{haceCuanto(checkInAt)}</Text>
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: t.espacio(3) }}>
                <Text mono variante="caption" style={{ color: t.colores.brandSoft }}>
                  {orden?.check_in_precision != null ? `Precisión GPS ±${Math.round(orden.check_in_precision)} m` : "Precisión GPS no disponible"}
                  {orden?.check_in_lat != null && orden?.check_in_lng != null
                    ? `  ·  ${orden.check_in_lat.toFixed(5)}, ${orden.check_in_lng.toFixed(5)}`
                    : ""}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text variante="caption" style={{ color: t.colores.brandSoft, letterSpacing: 1.2 }}>
                SIN CHECK-IN
              </Text>
              <Text tono="inverso">Marca tu llegada para empezar el trabajo.</Text>
              <Button
                titulo="Marcar check-in"
                variante="acento"
                cargando={marcando === "Check-in"}
                disabled={finalizada}
                onPress={() => marcar("Check-in")}
              />
            </>
          )}
        </View>

        {/* Filas de datos */}
        <View style={{ borderTopWidth: 1, borderTopColor: t.colores.border }}>
          <Fila etiqueta="Servicio" valor={trabajo.tipo_trabajo?.nombre ?? trabajo.descripcion ?? "—"} />
          {direccion ? <Fila etiqueta="Dirección" valor={direccion} onPress={abrirMapa} icono="navigate-outline" /> : null}
          {cli?.telefono ? (
            <Fila
              etiqueta="Contacto"
              valor={`${cli.nombre}${cli.telefono ? ` · ${cli.telefono}` : ""}`}
              onPress={() => Linking.openURL(`tel:${cli.telefono}`)}
              icono="call-outline"
            />
          ) : cli?.nombre ? (
            <Fila etiqueta="Contacto" valor={cli.nombre} />
          ) : null}
          {trabajo.equipo_id ? <Fila etiqueta="Equipo" valor="Equipo del cliente asociado" /> : null}
        </View>

        {/* Nota interna */}
        {trabajo.notas_internas ? (
          <View style={{ backgroundColor: t.colores.surfaceAlt, borderRadius: t.radio.md, padding: t.espacio(4), gap: t.espacio(1) }}>
            <Text variante="caption" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Nota interna
            </Text>
            <Text>{trabajo.notas_internas}</Text>
          </View>
        ) : null}

        {finalizada && (
          <View style={{ backgroundColor: t.colores.successSoft, borderRadius: t.radio.md, padding: t.espacio(3) }}>
            <Text variante="etiqueta" weight="semibold" style={{ color: t.colores.success }}>
              ✓ Trabajo finalizado — ya no se puede editar
            </Text>
          </View>
        )}

        {trabajo.tipo_trabajo ? (
          <CamposDinamicos
            nombre={trabajo.tipo_trabajo.nombre}
            campos={trabajo.tipo_trabajo.campos}
            valores={datosForm}
            onCambiar={(k, v) => setDatosForm((p) => ({ ...p, [k]: v }))}
            onGuardar={guardarDatos}
            guardando={guardandoDatos}
            editable={!finalizada}
          />
        ) : null}

        {/* Fotos */}
        <FotosSection
          fotos={fotos}
          pendientes={fotosPendientes}
          editable={!finalizada}
          onAgregar={(archivo) => void encolarFoto(trabajoId, archivo)}
          onQuitarPendiente={descartar}
        />

        <CierreFirma
          orden={orden}
          editable={!finalizada}
          onFirmar={(p) => encolarFirma(trabajoId, p)}
          onCerrar={finalizar}
          onGuardarSinFirmar={() =>
            Alert.alert("Guardado sin firmar", "La OS sigue abierta hasta que el cliente firme. Tus notas quedaron en pantalla.")
          }
        />

        {/* Pie de acciones */}
        {!finalizada && (
          <View style={{ gap: t.espacio(2), marginTop: t.espacio(2) }}>
            {checkIn?.hecho && !checkOut?.hecho ? (
              <Button titulo="Registrar salida y firmar" tamano="lg" cargando={marcando === "Check-out"} onPress={() => marcar("Check-out")} />
            ) : null}
            <Button
              titulo="Registrar venta"
              variante="secundario"
              onPress={() => Alert.alert("Registrar venta", "Disponible en la próxima actualización.")}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
