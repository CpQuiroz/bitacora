import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoTrabajo, ItemChecklist } from "@bitacora/shared";
import { estadoOsDeTrabajo } from "@bitacora/shared";
import { ChevronRight, Navigation, Phone, type LucideIcon } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, ErrorState, LoadingState, Skeleton, StatusBadge, Texto, useMarca } from "@bitacora/ui/native";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { ubicacionActual } from "../../lib/geo";
import {
  eliminarFoto,
  encolarCheckin,
  encolarDatos,
  encolarFinalizar,
  encolarFirma,
  encolarFirmaTecnico,
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

function Fila({ etiqueta, valor, onPress, Icono }: { etiqueta: string; valor: string; onPress?: () => void; Icono?: LucideIcon }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.space["3"],
        paddingVertical: tokens.space["3"],
        borderBottomWidth: 1,
        borderBottomColor: tokens.color.divider,
      }}
    >
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} style={{ width: 92 }}>
        {etiqueta}
      </Texto>
      <Texto tamano={tokens.size.body} color={tokens.color.text} style={{ flex: 1 }}>
        {valor}
      </Texto>
      {onPress ? (Icono ? <Icono size={18} strokeWidth={2.75} color={`${tokens.color.text}66`} /> : <ChevronRight size={18} strokeWidth={2.75} color={`${tokens.color.text}66`} />) : null}
    </Pressable>
  );
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function TrabajoDetalleScreen({ route, navigation }: NativeStackScreenProps<TrabajosStackParamList, "TrabajoDetalle">) {
  const { trabajoId } = route.params;
  const auth = useAuth();
  const marca = useMarca();
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

  if (!detalle && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg, padding: tokens.space["4"], gap: tokens.space["3"] }}>
        <LoadingState>
          <Skeleton alto={120} radio={28} />
          <Skeleton alto={44} radio={999} />
          <Skeleton alto={200} radio={16} />
        </LoadingState>
      </View>
    );
  }
  if (error && !detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }
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
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <OfflineBanner guardadoEn={detalle.desdeCache ? detalle.guardadoEn : undefined} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 3 }}>
        {/* Cabecera: folio + cliente */}
        <View style={{ gap: tokens.space["1"] }}>
          {orden?.folio != null ? (
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
              OS N° {orden.folio}
            </Texto>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.h4} color={tokens.color.text} style={{ flex: 1 }}>
              {cli?.nombre ?? trabajo.cliente}
            </Texto>
            <StatusBadge estado={estadoOsEfectivo} etiqueta={estadoMostrar} />
          </View>
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
            {trabajo.fecha}
            {trabajo.hora_programada ? ` · ${trabajo.hora_programada.slice(0, 5)}` : ""}
          </Texto>
          {esGestion ? (
            <Pressable onPress={() => navigation.navigate("TrabajoForm", { trabajoId })} style={{ marginTop: tokens.space["1"] }}>
              <Texto tamano={tokens.size.small} color={marca.base} peso="semibold">
                Editar datos
              </Texto>
            </Pressable>
          ) : null}
        </View>

        {/* Bloque de foco — el único con el fondo de marca */}
        <View style={{ backgroundColor: marca.base, borderRadius: 32, padding: tokens.space["6"], gap: tokens.space["3"] }}>
          {checkInAt ? (
            <>
              <Texto tamano={tokens.size.caption} color={`${marca.foreground}b3`} style={{ letterSpacing: 1.2 }}>
                CHECK-IN REGISTRADO
              </Texto>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: tokens.space["3"] }}>
                <Texto tamano={30} color={marca.foreground} style={{ fontVariant: ["tabular-nums"] }}>
                  {new Date(checkInAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                </Texto>
                <Texto tamano={tokens.size.body} color={`${marca.foreground}b3`}>
                  {haceCuanto(checkInAt)}
                </Texto>
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: `${marca.foreground}26`, paddingTop: tokens.space["3"] }}>
                <Texto tamano={tokens.size.caption} color={`${marca.foreground}b3`} style={{ fontVariant: ["tabular-nums"] }}>
                  {orden?.check_in_precision != null ? `Precisión GPS ±${Math.round(orden.check_in_precision)} m` : "Precisión GPS no disponible"}
                  {orden?.check_in_lat != null && orden?.check_in_lng != null
                    ? `  ·  ${orden.check_in_lat.toFixed(5)}, ${orden.check_in_lng.toFixed(5)}`
                    : ""}
                </Texto>
              </View>
            </>
          ) : (
            <>
              <Texto tamano={tokens.size.caption} color={`${marca.foreground}b3`} style={{ letterSpacing: 1.2 }}>
                SIN CHECK-IN
              </Texto>
              <Texto tamano={tokens.size.body} color={marca.foreground}>
                Marca tu llegada para empezar el trabajo.
              </Texto>
              <Button cargando={marcando === "Check-in"} deshabilitado={finalizada} onPress={() => marcar("Check-in")}>
                Marcar check-in
              </Button>
            </>
          )}
        </View>

        {/* Filas de datos */}
        <View style={{ borderTopWidth: 1, borderTopColor: tokens.color.divider }}>
          <Fila etiqueta="Servicio" valor={trabajo.tipo_trabajo?.nombre ?? trabajo.descripcion ?? "—"} />
          {direccion ? <Fila etiqueta="Dirección" valor={direccion} onPress={abrirMapa} Icono={Navigation} /> : null}
          {cli?.telefono ? (
            <Fila
              etiqueta="Contacto"
              valor={`${cli.nombre}${cli.telefono ? ` · ${cli.telefono}` : ""}`}
              onPress={() => Linking.openURL(`tel:${cli.telefono}`)}
              Icono={Phone}
            />
          ) : cli?.nombre ? (
            <Fila etiqueta="Contacto" valor={cli.nombre} />
          ) : null}
          {trabajo.equipo_id ? <Fila etiqueta="Equipo" valor="Equipo del cliente asociado" /> : null}
        </View>

        {/* Nota interna */}
        {trabajo.notas_internas ? (
          <View style={{ backgroundColor: tokens.color.neutral["200"], borderRadius: tokens.radius.md, padding: tokens.space["4"], gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
              Nota interna
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text}>
              {trabajo.notas_internas}
            </Texto>
          </View>
        ) : null}

        {finalizada ? (
          <View style={{ backgroundColor: tokens.color.accent2Ramp["200"], borderRadius: tokens.radius.md, padding: tokens.space["3"] }}>
            <Texto tamano={tokens.size.small} color={tokens.color.accent2Ramp["800"]} peso="semibold">
              Trabajo finalizado — ya no se puede editar
            </Texto>
          </View>
        ) : null}

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
          onAgregar={(archivo, categoria) => void encolarFoto(trabajoId, archivo, categoria)}
          onQuitarPendiente={descartar}
          onEliminar={async (fotoId) => {
            const res = await eliminarFoto(trabajoId, fotoId);
            if (!res.ok) {
              Alert.alert("No se pudo eliminar", res.error);
              return;
            }
            void cargar();
          }}
        />

        <CierreFirma
          orden={orden}
          editable={!finalizada}
          onFirmar={(p) => encolarFirma(trabajoId, p)}
          onFirmarTecnico={(p) => encolarFirmaTecnico(trabajoId, p)}
          onCerrar={finalizar}
          onGuardarSinFirmar={() =>
            Alert.alert("Guardado sin firmar", "La OS sigue abierta hasta que el cliente firme. Tus notas quedaron en pantalla.")
          }
        />

        {/* Pie de acciones */}
        {!finalizada ? (
          <View style={{ gap: tokens.space["2"], marginTop: tokens.space["2"] }}>
            {checkIn?.hecho && !checkOut?.hecho ? (
              <Button tamano="lg" bloque cargando={marcando === "Check-out"} onPress={() => marcar("Check-out")}>
                Registrar salida y firmar
              </Button>
            ) : null}
            {trabajo.cliente_id ? (
              <Button
                variante="secundario"
                bloque
                onPress={() =>
                  navigation.navigate("RegistrarVenta", {
                    origenTipo: "os",
                    origenId: trabajoId,
                    clienteId: trabajo.cliente_id!,
                    clienteNombre: cli?.nombre ?? trabajo.cliente,
                    folio: orden?.folio ?? null,
                  })
                }
              >
                Registrar venta
              </Button>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
