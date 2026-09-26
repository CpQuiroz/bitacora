import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoTrabajo, ItemChecklist } from "@bitacora/shared";
import { estadoOsDeTrabajo, formatearFolio } from "@bitacora/shared";
import { ArrowLeft, ChevronRight, Navigation, Phone, type LucideIcon } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, ErrorState, LoadingState, ScreenHeader, Skeleton, StatusBadge, Textarea, Texto, useMarca } from "@bitacora/ui/native";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { accesoDesdeAuth } from "../../lib/modulos";
import { ubicacionActual } from "../../lib/geo";
import {
  eliminarFoto,
  encolarCheckin,
  encolarClienteNoDisponible,
  encolarDatos,
  encolarDescripcionFoto,
  encolarFinalizar,
  encolarFirma,
  encolarFoto,
  encolarObservaciones,
  obtenerDetalle,
  type DetalleTrabajo,
} from "../../services/trabajos";
import { CamposDinamicos } from "./components/CamposDinamicos";
import { FotosSection } from "./components/FotosSection";
import { CierreFirma, type ConfirmarCierrePayload } from "./components/CierreFirma";
import { IndicadorPasos } from "./components/IndicadorPasos";
import type { TrabajosStackParamList } from "../../shell/navigation/types";
import { registrarEvento } from "../../lib/analytics";
import { EVENTOS } from "@bitacora/shared";

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

// Sistema visual móvil v2 (13-sep-2026, tarea #21, piloto 3).
//
// Flujo simplificado de 3 pasos (Fase 3.4, 23-sep-2026, pedido
// explícito — reemplaza al flujo anterior de checklist/fotos/firma
// todo junto en una sola pantalla larga, sin orden forzado):
//   1. INICIAR — un botón, registra check-in (hora + GPS, o "sin
//      ubicación" si no hay permiso/señal — se puede seguir igual).
//   2. EJECUTAR — checklist + fotos con detalle + materiales, en una
//      sola pantalla, autoguardado.
//   3. CERRAR — resumen → nombre del encargado + firma (o "cliente no
//      disponible": motivo + foto) → Confirmar. Al confirmar: check-
//      out automático + firma/no-disponible + /finalizar, en cadena.
//
// Migración de OS en curso (Fase 3.4c): NO hay backfill ni mapeo de
// estados — el paso que corresponde se DERIVA de los mismos datos de
// siempre (check_in_at/check_out_at), así una OS que ya tenía check-in
// (o incluso check-out) hecho con el flujo VIEJO antes de este cambio
// abre directo en el paso que le toca, sin perder nada ya capturado.
// `pasoOverride` es solo la navegación manual (Continuar/Volver)
// dentro de la MISMA sesión — se resetea si se recarga la pantalla,
// volviendo a derivarse de los datos reales.
export function TrabajoDetalleScreen({ route, navigation }: NativeStackScreenProps<TrabajosStackParamList, "TrabajoDetalle">) {
  const { trabajoId, titulo: tituloRuta } = route.params;
  const auth = useAuth();
  const marca = useMarca();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const { pendientes, fallidas, enLinea, descartar } = useRed();
  // Clave del campo tipo "foto" al que apunta una acción encolada de
  // foto (migración 105) — undefined = galería general.
  const campoClaveDe = (a: { body?: unknown }) => (a.body as { campo_clave?: string } | undefined)?.campo_clave;
  const fotosPendientesTodas = useMemo(() => {
    const esFotoDeAca = (a: (typeof pendientes)[number]) => a.recurso === `trabajo:${trabajoId}` && a.etiqueta === "Foto";
    return [
      ...pendientes.filter(esFotoDeAca).map((a) => ({ id: a.id, uri: a.archivo?.uri ?? "", fallida: false, error: a.ultimoError, campoClave: campoClaveDe(a) })),
      ...fallidas.filter(esFotoDeAca).map((a) => ({ id: a.id, uri: a.archivo?.uri ?? "", fallida: true, error: a.ultimoError, campoClave: campoClaveDe(a) })),
    ];
  }, [pendientes, fallidas, trabajoId]);
  const fotosPendientes = useMemo(() => fotosPendientesTodas.filter((f) => !f.campoClave), [fotosPendientesTodas]);
  const fotosPendientesPorCampo = useMemo(() => {
    const mapa: Record<string, typeof fotosPendientesTodas> = {};
    for (const f of fotosPendientesTodas) {
      if (!f.campoClave) continue;
      mapa[f.campoClave] = [...(mapa[f.campoClave] ?? []), f];
    }
    return mapa;
  }, [fotosPendientesTodas]);
  const [detalle, setDetalle] = useState<DetalleTrabajo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datosForm, setDatosForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [marcando, setMarcando] = useState<"Check-in" | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pasoOverride, setPasoOverride] = useState<2 | 3 | null>(null);
  // Autoguardado del formulario (Fase 3.4b) — solo dispara si el
  // cambio vino de que el usuario tipeó algo (onCambiar), nunca por el
  // set inicial al cargar el detalle.
  const formTocado = useRef(false);
  // Comentarios del técnico (observaciones_cierre) — mismo criterio de
  // "tocado": la recarga periódica (fotos procesando, cada 8 s) no pisa
  // lo que el técnico está escribiendo.
  const [observaciones, setObservaciones] = useState("");
  const observacionesTocadas = useRef(false);
  const fotosPorCampo = useMemo(() => {
    const mapa: Record<string, DetalleTrabajo["fotos"]> = {};
    for (const f of detalle?.fotos ?? []) {
      if (!f.campo_clave) continue;
      mapa[f.campo_clave] = [...(mapa[f.campo_clave] ?? []), f];
    }
    return mapa;
  }, [detalle]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await obtenerDetalle(trabajoId);
      setDetalle(d);
      setDatosForm(Object.fromEntries(Object.entries(d.trabajo.datos ?? {}).map(([k, v]) => [k, String(v ?? "")])));
      formTocado.current = false;
      if (!observacionesTocadas.current) setObservaciones(d.orden?.observaciones_cierre ?? "");
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

  // Autoguardados (comentarios del técnico y formulario del paso 2).
  // Tienen que declararse ANTES de los returns anticipados de abajo:
  // un hook después de `if (!detalle) return …` hace que el primer
  // render (cargando) tenga menos hooks que el siguiente y React tumba
  // la app en release ("Rendered more hooks…", crash al abrir una OS en
  // 1.10.16). Las funciones y el paso se leen por ref porque se definen
  // más abajo, ya con `detalle` resuelto.
  const guardarObservacionesRef = useRef<() => Promise<void>>(async () => {});
  const guardarDatosRef = useRef<() => Promise<void>>(async () => {});
  const pasoRef = useRef<1 | 2 | 3>(1);
  useEffect(() => {
    if (!observacionesTocadas.current) return;
    const t = setTimeout(() => void guardarObservacionesRef.current(), 1500);
    return () => clearTimeout(t);
  }, [observaciones]);
  useEffect(() => {
    if (!formTocado.current || pasoRef.current !== 2) return;
    const t = setTimeout(() => void guardarDatosRef.current(), 1500);
    return () => clearTimeout(t);
  }, [datosForm]);

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!detalle && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={tituloRuta ?? "Orden de servicio"} accion={volver} />
        <View style={{ padding: tokens.space["4"], gap: tokens.space["3"] }}>
          <LoadingState>
            <Skeleton alto={120} radio={28} />
            <Skeleton alto={44} radio={999} />
            <Skeleton alto={200} radio={16} />
          </LoadingState>
        </View>
      </View>
    );
  }
  if (error && !detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={tituloRuta ?? "Orden de servicio"} accion={volver} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }
  if (!detalle) return null;

  const { trabajo, orden, fotos: fotosTodas } = detalle;
  // Fotos de un campo tipo "foto" (migración 105) se sacan de la
  // galería general — se muestran junto al campo en CamposDinamicos.
  const fotos = fotosTodas.filter((f) => !f.campo_clave);
  const cli = trabajo.cliente_info;
  const finalizada = Boolean(orden?.finalizada_en) || confirmando;
  const checklist: ItemChecklist[] = orden?.checklist ?? [];
  const checkIn = checklist.find((c) => c.item === "Check-in");
  const checkOut = checklist.find((c) => c.item === "Check-out");
  const estadoOsEfectivo = orden?.estado_os ?? estadoOsDeTrabajo(trabajo.estado as EstadoTrabajo);
  const estadoMostrar = ETIQUETA_OS[estadoOsEfectivo] ?? estadoOsEfectivo;
  const direccion = cli?.direccion || trabajo.ubicacion;
  const coords = cli?.lat != null && cli?.lng != null ? { lat: cli.lat, lng: cli.lng } : null;
  const checkInAt = orden?.check_in_at ?? checkIn?.hora ?? null;

  // Paso derivado de los datos reales (nunca de un estado aparte) —
  // ver el comentario largo arriba del componente.
  const pasoBase: 1 | 2 | 3 = !checkInAt ? 1 : checkOut?.hecho ? 3 : 2;
  const paso: 1 | 2 | 3 = pasoOverride ?? pasoBase;
  pasoRef.current = paso;

  function abrirMapa() {
    const destino = coords ? `${coords.lat},${coords.lng}` : encodeURIComponent(direccion ?? "");
    if (!destino) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${destino}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
    });
    Linking.openURL(url!);
  }

  async function marcarCheckIn() {
    setMarcando("Check-in");
    const ubic = await ubicacionActual();
    if (!ubic) {
      Alert.alert("Sin ubicación", "Se registrará la llegada sin coordenadas (permiso denegado o GPS no disponible).");
    }
    await encolarCheckin(trabajoId, "Check-in", ubic);
    setMarcando(null);
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            orden: {
              ...(prev.orden ?? ({} as NonNullable<DetalleTrabajo["orden"]>)),
              checklist: [...(prev.orden?.checklist ?? []).filter((c) => c.item !== "Check-in"), { item: "Check-in", hecho: true, hora: new Date().toISOString() }],
              check_in_at: new Date().toISOString(),
              ...(ubic ? { check_in_lat: ubic.lat, check_in_lng: ubic.lng, check_in_precision: ubic.precision_m } : {}),
            } as DetalleTrabajo["orden"],
          }
        : prev
    );
  }

  async function guardarObservaciones() {
    if (!observacionesTocadas.current) return;
    await encolarObservaciones(trabajoId, observaciones.trim());
    observacionesTocadas.current = false;
  }

  // Autoguardado de los comentarios: el efecto (debounce 1,5 s) vive
  // arriba de los returns anticipados; acá solo se le pasa la función.
  guardarObservacionesRef.current = guardarObservaciones;

  async function guardarDatos() {
    setGuardandoDatos(true);
    await encolarDatos(trabajoId, datosForm);
    setGuardandoDatos(false);
  }

  // Autoguardado (Fase 3.4b, "autoguardado continuo") — debounced,
  // solo si el usuario tocó algo (efecto arriba de los returns
  // anticipados). La cola offline (encolarDatos) ya garantiza que quede
  // guardado localmente y se sincronice solo al recuperar señal.
  guardarDatosRef.current = guardarDatos;

  async function confirmarCierre(payload: ConfirmarCierrePayload) {
    setConfirmando(true);
    try {
      // 1) Check-out automático — salvo que ya estuviera hecho de
      // antes (OS en curso con el flujo viejo, donde salida y firma
      // eran pasos separados).
      if (!checkOut?.hecho) {
        const ubic = await ubicacionActual();
        await encolarCheckin(trabajoId, "Check-out", ubic);
      }
      // 1b) Comentarios del técnico que hayan quedado sin autoguardar.
      await guardarObservaciones();
      // 2) Firma del encargado, o "cliente no disponible".
      if (payload.tipo === "firma") {
        await encolarFirma(trabajoId, {
          firma_base64: payload.firma_base64,
          firmante_nombre: payload.firmante_nombre,
        });
      } else {
        await encolarClienteNoDisponible(trabajoId, payload.motivo, payload.foto);
      }
      // 3) Cierre real.
      await encolarFinalizar(trabajoId);
      registrarEvento(EVENTOS.osCerradaFirmada, { con_firma: payload.tipo === "firma", sin_conexion: !enLinea });
      Alert.alert(
        "Orden de servicio cerrada",
        enLinea ? "Quedó cerrada." : "Quedó cerrada. Se enviará a la oficina apenas vuelvas a tener señal.",
        [{ text: "Listo", onPress: () => navigation.goBack() }]
      );
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo={formatearFolio("OS", orden?.folio) ?? undefined} titulo={cli?.nombre ?? trabajo.cliente} accion={volver} />
      <OfflineBanner guardadoEn={detalle.desdeCache ? detalle.guardadoEn : undefined} />
      {!finalizada ? (
        <View style={{ paddingTop: tokens.space["2"] }}>
          <IndicadorPasos pasoActual={paso} />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 3 }}>
        {/* Estado + fecha + editar — no entran en ScreenHeader (sin lugar
            para badge ni segunda línea), quedan como su propio bloque. */}
        <View style={{ gap: tokens.space["1"] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
              {trabajo.fecha}
              {trabajo.hora_programada ? ` · ${trabajo.hora_programada.slice(0, 5)}` : ""}
            </Texto>
            <StatusBadge estado={estadoOsEfectivo} etiqueta={estadoMostrar} />
          </View>
          {esGestion ? (
            <Pressable onPress={() => navigation.navigate("TrabajoForm", { trabajoId })} style={{ marginTop: tokens.space["1"] }}>
              <Texto tamano={tokens.size.small} color={marca.base} peso="semibold">
                Editar datos
              </Texto>
            </Pressable>
          ) : null}
        </View>

        {/* Datos de contacto/servicio — contexto visible en los 3 pasos. */}
        <View style={{ borderTopWidth: 1, borderTopColor: tokens.color.divider }}>
          <Fila etiqueta="Servicio" valor={trabajo.descripcion ?? "—"} />
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

        {finalizada && !confirmando ? (
          <View style={{ backgroundColor: tokens.color.accent2Ramp["200"], borderRadius: tokens.radius.md, padding: tokens.space["3"] }}>
            <Texto tamano={tokens.size.small} color={tokens.color.accent2Ramp["800"]} peso="semibold">
              Orden de servicio finalizada — ya no se puede editar
            </Texto>
          </View>
        ) : null}

        {/* ---------- Paso 1 — INICIAR ---------- */}
        {!finalizada && paso === 1 ? (
          <View style={{ backgroundColor: marca.suave, borderRadius: 32, padding: tokens.space["6"], gap: tokens.space["3"] }}>
            <Texto tamano={tokens.size.caption} color={`${marca.fuerte}b3`} style={{ letterSpacing: 1.2 }}>
              SIN INICIAR
            </Texto>
            <Texto tamano={tokens.size.body} color={marca.fuerte}>
              Marca tu llegada para empezar el trabajo.
            </Texto>
            <Button tamano="lg" cargando={marcando === "Check-in"} onPress={marcarCheckIn}>
              Marcar llegada
            </Button>
          </View>
        ) : null}

        {/* ---------- Paso 2 — EJECUTAR (y resumen de llegada si ya se pasó) ---------- */}
        {finalizada || paso >= 2 ? (
          <View style={{ backgroundColor: marca.suave, borderRadius: 32, padding: tokens.space["6"], gap: tokens.space["3"] }}>
            <Texto tamano={tokens.size.caption} color={`${marca.fuerte}b3`} style={{ letterSpacing: 1.2 }}>
              LLEGADA REGISTRADA
            </Texto>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: tokens.space["3"] }}>
              <Texto tamano={30} color={marca.fuerte} style={{ fontVariant: ["tabular-nums"] }}>
                {checkInAt ? new Date(checkInAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "—"}
              </Texto>
              {checkInAt ? (
                <Texto tamano={tokens.size.body} color={`${marca.fuerte}b3`}>
                  {haceCuanto(checkInAt)}
                </Texto>
              ) : null}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: `${marca.fuerte}26`, paddingTop: tokens.space["3"] }}>
              <Texto tamano={tokens.size.caption} color={`${marca.fuerte}b3`} style={{ fontVariant: ["tabular-nums"] }}>
                {orden?.check_in_precision != null ? `Precisión GPS ±${Math.round(orden.check_in_precision)} m` : "Sin ubicación registrada"}
                {orden?.check_in_lat != null && orden?.check_in_lng != null
                  ? `  ·  ${orden.check_in_lat.toFixed(5)}, ${orden.check_in_lng.toFixed(5)}`
                  : ""}
              </Texto>
            </View>
          </View>
        ) : null}

        {(finalizada || paso === 2) && trabajo.tipo ? (
          <CamposDinamicos
            nombre={trabajo.tipo.nombre}
            campos={trabajo.tipo.campos}
            valores={datosForm}
            onCambiar={(k, v) => {
              formTocado.current = true;
              setDatosForm((p) => ({ ...p, [k]: v }));
            }}
            onGuardar={guardarDatos}
            guardando={guardandoDatos}
            editable={!finalizada && paso === 2}
            fotosPorCampo={fotosPorCampo}
            fotosPendientesPorCampo={fotosPendientesPorCampo}
            onAgregarFoto={(clave, archivo) => void encolarFoto(trabajoId, archivo, null, clave)}
            onQuitarFotoPendiente={descartar}
            onEliminarFoto={async (fotoId) => {
              const res = await eliminarFoto(trabajoId, fotoId);
              if (!res.ok) {
                Alert.alert("No se pudo eliminar", res.error);
                return;
              }
              void cargar();
            }}
          />
        ) : null}

        {finalizada || paso === 2 ? (
          <FotosSection
            fotos={fotos}
            pendientes={fotosPendientes}
            editable={!finalizada && paso === 2}
            onAgregar={(archivo, categoria) => void encolarFoto(trabajoId, archivo, categoria)}
            onQuitarPendiente={descartar}
            onDescripcion={async (fotoId, texto) => {
              await encolarDescripcionFoto(trabajoId, fotoId, texto);
              // Optimista: la cola la sincroniza; se ve al instante.
              setDetalle((prev) =>
                prev ? { ...prev, fotos: prev.fotos.map((f) => (f.id === fotoId ? { ...f, descripcion: texto || null } : f)) } : prev
              );
            }}
            onEliminar={async (fotoId) => {
              const res = await eliminarFoto(trabajoId, fotoId);
              if (!res.ok) {
                Alert.alert("No se pudo eliminar", res.error);
                return;
              }
              void cargar();
            }}
          />
        ) : null}

        {/* Comentarios del técnico — debajo de las fotos (23-sep-2026).
            Antes era "Observación (opcional)" bajo la firma del paso 3,
            y no existía en el cierre "cliente no disponible". */}
        {!finalizada && paso === 2 ? (
          <Textarea
            etiqueta="Comentarios del técnico"
            placeholder="Observaciones sobre el trabajo realizado"
            filas={4}
            valor={observaciones}
            onCambio={(v) => {
              observacionesTocadas.current = true;
              setObservaciones(v);
            }}
          />
        ) : finalizada && orden?.observaciones_cierre ? (
          <View style={{ gap: tokens.space["1"] }}>
            <Texto tamano={tokens.size.small} peso="semibold" color={`${tokens.color.text}99`}>
              Comentarios del técnico
            </Texto>
            <Texto tamano={tokens.size.body} color={tokens.color.text}>
              {orden.observaciones_cierre}
            </Texto>
          </View>
        ) : null}

        {!finalizada && paso === 2 ? (
          <Button tamano="lg" bloque onPress={() => setPasoOverride(3)}>
            Continuar
          </Button>
        ) : null}

        {/* ---------- Paso 3 — CERRAR ---------- */}
        {finalizada || paso === 3 ? (
          <>
            {!finalizada ? (
              <Pressable onPress={() => setPasoOverride(2)} style={{ alignSelf: "flex-start" }}>
                <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} style={{ textDecorationLine: "underline" }}>
                  ← Volver a Ejecutar
                </Texto>
              </Pressable>
            ) : null}
            <CierreFirma orden={orden} editable={!finalizada} confirmando={confirmando} onConfirmar={confirmarCierre} />
          </>
        ) : null}

        {/* Registrar venta — independiente de en qué paso esté el
            cierre, se puede hacer en cualquier momento antes de
            finalizar (igual que en el flujo anterior). */}
        {!finalizada && trabajo.cliente_id && accesoDesdeAuth(auth).registrarVenta ? (
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
      </ScrollView>
    </View>
  );
}
