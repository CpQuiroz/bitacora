import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { ArrowLeft, ClipboardCheck, FileText, Plus, Route } from "lucide-react-native";
import type { PlanMantencion, Usuario } from "@bitacora/shared";
import { ROLES_SUPERVISION } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, ErrorState, LoadingState, ScreenHeader, StatusBadge, Texto, useMarca } from "@bitacora/ui/native";
import { PickerBuscable } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import type { MasStackParamList } from "../../shell/navigation/types";
import {
  asignarVehiculo,
  borrarDocumento,
  borrarPlan,
  cambiarEstadoPlan,
  colaboradoresAsignables,
  desasignarVehiculo,
  esVehiculo,
  listarDocumentosVehiculo,
  listarViajesDeEquipo,
  obtenerEquipo,
  planesDeEquipo,
  urlArchivoDocumento,
  type DocumentoConTipo,
  type EquipoDetalle,
  type ViajeDeEquipo,
} from "../../services/equipos";
import { obtenerHistorialEquipo, obtenerMantencionInicio, type MantencionResumen } from "../../services/mantencion";
import { permisosEquipos } from "./permisos";
import { fechaLegible } from "./fechas";

type Tab = "resumen" | "actividad" | "mantencion" | "documentos" | "eventos";
type FiltroActividad = "todo" | "os" | "viajes";

const ETIQUETA_ESTADO_DOC = { vigente: "Vigente", por_vencer: "Por vencer", vencido: "Vencido" } as const;
const TONO_ESTADO_DOC = { vigente: "completado", por_vencer: "advertencia", vencido: "peligro" } as const;

// Tarea 146: ficha del equipo en mobile — datos, asignación, documentos
// (vehículos), plan de mantención preventiva, historial de OS y accesos a
// Mantención/Eventos (pantallas que ya existían).
export function EquipoDetalleScreen({ navigation, route }: NativeStackScreenProps<MasStackParamList, "EquipoDetalle">) {
  const { equipoId } = route.params;
  const auth = useAuth();
  const marca = useMarca();
  const permisos = permisosEquipos(auth);
  const miId = auth.fase === "listo" ? auth.usuario.id : null;

  const [equipo, setEquipo] = useState<EquipoDetalle | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoConTipo[]>([]);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);
  const [planes, setPlanes] = useState<PlanMantencion[]>([]);
  const [colaboradores, setColaboradores] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // Tarea 148: pestañas (mismas que la web): Resumen · Mantención · OS ·
  // Viajes · Documentos · Eventos.
  const [tab, setTab] = useState<Tab>("resumen");
  const [filtroActividad, setFiltroActividad] = useState<FiltroActividad>("todo");
  const [viajes, setViajes] = useState<ViajeDeEquipo[] | null>(null);
  const [errorViajes, setErrorViajes] = useState<string | null>(null);
  const esSupervision = auth.fase === "listo" && ROLES_SUPERVISION.includes(auth.usuario.rol);
  const [registros, setRegistros] = useState<MantencionResumen[]>([]);
  const veViajes = auth.fase === "listo" && auth.modulosVisibles.includes("viajes");

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const e = await obtenerEquipo(equipoId);
      setEquipo(e);
      const vehiculo = esVehiculo(e);
      const asignadoAMi = Boolean(miId && e.asignacion_vigente?.colaborador_id === miId);
      const [docs, pl] = await Promise.all([
        vehiculo && permisos.documentos(asignadoAMi) ? listarDocumentosVehiculo(e.id).then((d) => ({ d, err: null }), (x: Error) => ({ d: [], err: x.message })) : Promise.resolve({ d: [], err: null }),
        planesDeEquipo(e.id).catch(() => []),
      ]);
      setDocumentos(docs.d);
      setErrorDocs(docs.err);
      setPlanes(pl);
      if (vehiculo && permisos.asignar) setColaboradores(await colaboradoresAsignables());
      if (vehiculo) {
        // Últimos registros de mantención: con Flota, los del equipo; el
        // chofer, los de su camión asignado.
        if (permisos.flota) setRegistros((await obtenerHistorialEquipo(e.id)).registros.slice(0, 5));
        else if (asignadoAMi) setRegistros((await obtenerMantencionInicio(5)).datos.registros);
        if (veViajes) {
          try {
            setViajes(await listarViajesDeEquipo(e.id));
            setErrorViajes(null);
          } catch (x) {
            setViajes([]);
            setErrorViajes(x instanceof Error ? x.message : "No se pudieron cargar los viajes");
          }
        }
      }
    } catch (x) {
      setError(x instanceof Error ? x.message : "No se pudo cargar");
    }
    // permisos se recalcula en cada render; basta con sus valores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId, miId, permisos.flota, permisos.asignar, veViajes]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!equipo) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Equipo" accion={volver} />
        {error ? (
          <ErrorState mensaje="No se pudo cargar el equipo. Revisa tu conexión." onReintentar={() => void cargar()} />
        ) : (
          <View style={{ padding: tokens.space["4"] }}>
            <LoadingState />
          </View>
        )}
      </View>
    );
  }

  const vehiculo = esVehiculo(equipo);
  const asignadoAMi = Boolean(miId && equipo.asignacion_vigente?.colaborador_id === miId);
  const puedeEditar = permisos.editarEquipo(vehiculo);
  const puedeDocs = vehiculo && permisos.documentos(asignadoAMi);

  async function conOcupado(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, exito?: string) {
    setOcupado(true);
    const r = await accion();
    setOcupado(false);
    if (!r.ok) {
      Alert.alert("No se pudo", r.error);
      return;
    }
    if (exito) Alert.alert(exito);
    await cargar();
  }

  async function abrirArchivo(d: DocumentoConTipo) {
    try {
      const url = await urlArchivoDocumento(d.id);
      await WebBrowser.openBrowserAsync(url);
    } catch (x) {
      Alert.alert("No se pudo abrir", x instanceof Error ? x.message : "Intenta de nuevo con conexión.");
    }
  }

  function opcionesDocumento(d: DocumentoConTipo) {
    const botones: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [];
    if (d.archivo_key) botones.push({ text: "Ver archivo", onPress: () => void abrirArchivo(d) });
    if (puedeDocs) botones.push({ text: "Editar", onPress: () => navigation.navigate("DocumentoForm", { equipoId: equipo!.id, documentoId: d.id }) });
    if (permisos.borrarDocumento) {
      botones.push({
        text: "Eliminar",
        style: "destructive",
        onPress: () =>
          Alert.alert("Eliminar documento", `Se elimina "${d.tipo?.nombre ?? "Documento"}" de la lista de este vehículo.`, [
            { text: "No", style: "cancel" },
            { text: "Sí, eliminar", style: "destructive", onPress: () => void conOcupado(() => borrarDocumento(d.id)) },
          ]),
      });
    }
    botones.push({ text: "Cancelar", style: "cancel" });
    Alert.alert(d.tipo?.nombre ?? "Documento", d.numero ? `N° ${d.numero}` : undefined, botones);
  }

  function opcionesPlan(p: PlanMantencion) {
    Alert.alert("Plan de mantención", `Cada ${p.frecuencia_dias} días`, [
      { text: "Editar", onPress: () => navigation.navigate("PlanMantencionForm", { equipoId: equipo!.id, planId: p.id }) },
      { text: p.activo ? "Pausar" : "Reactivar", onPress: () => void conOcupado(() => cambiarEstadoPlan(p.id, !p.activo)) },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () =>
          Alert.alert("Eliminar plan", "¿Seguro?", [
            { text: "No", style: "cancel" },
            { text: "Sí, eliminar", style: "destructive", onPress: () => void conOcupado(() => borrarPlan(p.id)) },
          ]),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function registrarMantencion() {
    const patente = equipo!.patente ?? null;
    Alert.alert("Registrar mantención", undefined, [
      { text: "Checklist diario", onPress: () => navigation.navigate("ChecklistMantencion", { equipoId: equipo!.id, tipo: "diario", patente }) },
      { text: "Programa (service)", onPress: () => navigation.navigate("ChecklistMantencion", { equipoId: equipo!.id, tipo: "programa", patente }) },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  const datos: [string, string | null][] = [
    ["Categoría", equipo.categoria],
    ["Patente", vehiculo ? equipo.patente : null],
    ["Marca", equipo.marca],
    ["Modelo", equipo.modelo],
    ["Año", equipo.anio != null ? String(equipo.anio) : null],
    ["Tipo", vehiculo ? equipo.tipo_vehiculo : null],
    ["Capacidad de carga", vehiculo ? equipo.capacidad_carga : null],
    ["N° de serie", equipo.numero_serie],
    ["Vencimiento de garantía", equipo.garantia_vencimiento ? fechaLegible(equipo.garantia_vencimiento) : null],
    ["Notas", equipo.notas],
  ];

  const historial = equipo.historico_mantenciones ?? [];
  const pestanas: { valor: Tab; etiqueta: string }[] = [
    { valor: "resumen", etiqueta: "Resumen" },
    // Tarea 150: OS y viajes juntos en "Actividad".
    { valor: "actividad", etiqueta: "Actividad" },
    { valor: "mantencion", etiqueta: "Mantención" },
    ...(vehiculo && puedeDocs ? [{ valor: "documentos" as Tab, etiqueta: "Documentos" }] : []),
    ...(vehiculo ? [{ valor: "eventos" as Tab, etiqueta: "Eventos" }] : []),
  ];
  // Si la pestaña activa deja de existir (cambian módulos o categoría), volver al resumen.
  if (!pestanas.some((p) => p.valor === tab)) setTab("resumen");
  // Actividad: OS y viajes del equipo en una sola lista por fecha.
  const incluirViajes = vehiculo && veViajes;
  const actividad = [
    ...(filtroActividad !== "viajes"
      ? historial.map((t) => ({
          clave: `os-${t.id}`,
          tipo: "os" as const,
          id: t.id,
          fecha: t.fecha,
          titulo: t.orden?.folio != null ? `OS N° ${t.orden.folio}` : "OS sin folio",
          detalle: t.descripcion || null,
          estado: t.orden?.estado_os ?? t.estado,
          total: null as number | null,
        }))
      : []),
    ...(incluirViajes && filtroActividad !== "os"
      ? (viajes ?? []).map((v) => ({
          clave: `viaje-${v.id}`,
          tipo: "viaje" as const,
          id: v.id,
          fecha: v.fecha,
          titulo: v.numero_guia ? `Viaje · Guía ${v.numero_guia}` : "Viaje",
          detalle: [`${v.origen} → ${v.destino}`, v.chofer?.nombre].filter(Boolean).join(" · "),
          estado: v.estado,
          total: v.total,
        }))
      : []),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const proximaMantencion = planes.filter((p) => p.activo).map((p) => p.proxima_fecha).sort()[0] ?? null;
  const vencidos = documentos.filter((d) => d.estado === "vencido").length;
  const porVencer = documentos.filter((d) => d.estado === "por_vencer").length;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        antetitulo={vehiculo ? (equipo.patente ?? "Vehículo") : (equipo.categoria ?? "Equipo")}
        titulo={equipo.nombre}
        accion={volver}
        filtros={{ opciones: pestanas, valor: tab, onCambio: (v) => setTab(v as Tab) }}
        filtrosSecundarios={
          tab === "actividad" && incluirViajes
            ? {
                opciones: [
                  { valor: "todo", etiqueta: "Todo" },
                  { valor: "os", etiqueta: "OS" },
                  { valor: "viajes", etiqueta: "Viajes" },
                ],
                valor: filtroActividad,
                onCambio: (v) => setFiltroActividad(v as FiltroActividad),
              }
            : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["3"], paddingBottom: tokens.space["8"] }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={async () => {
              setRefrescando(true);
              await cargar();
              setRefrescando(false);
            }}
          />
        }
      >
        {tab === "resumen" ? (
          <>
          <Card>
            <Encabezado titulo="Resumen" />
            <Fila etiqueta="Próxima mantención" valor={proximaMantencion ? fechaLegible(proximaMantencion) : "Sin plan"} />
            {vehiculo ? <Fila etiqueta="Chofer" valor={equipo.asignacion_vigente?.colaborador_nombre ?? "Sin asignar"} /> : null}
            {vehiculo && puedeDocs ? (
              <Fila etiqueta="Documentos" valor={vencidos ? `${vencidos} vencido${vencidos > 1 ? "s" : ""}` : porVencer ? `${porVencer} por vencer` : "Al día"} />
            ) : null}
          </Card>
          <Card>
            <Encabezado titulo="Datos">
              {puedeEditar ? <Accion texto="Editar" color={marca.base} onPress={() => navigation.navigate("EquipoForm", { equipoId: equipo.id })} /> : null}
            </Encabezado>
            {datos
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <Fila key={k} etiqueta={k} valor={v!} />
              ))}
          </Card>

          {vehiculo ? (
            <Card>
              <Encabezado titulo="Asignado a" />
              <Texto tamano={tokens.size.body} color={tokens.color.text}>
                {equipo.asignacion_vigente?.colaborador_nombre ?? "Sin asignar"}
              </Texto>
              {permisos.asignar ? (
                <View style={{ gap: tokens.space["2"], marginTop: tokens.space["2"] }}>
                  <PickerBuscable
                    etiqueta="Cambiar chofer"
                    placeholder="Elegir chofer"
                    valor={equipo.asignacion_vigente?.colaborador_id ?? ""}
                    opciones={colaboradores.map((c) => ({ id: c.id, label: c.nombre }))}
                    onElegir={(id) => {
                      if (id && id !== equipo.asignacion_vigente?.colaborador_id) void conOcupado(() => asignarVehiculo(equipo.id, id));
                    }}
                  />
                  {equipo.asignacion_vigente ? (
                    <Button variante="ghost" deshabilitado={ocupado} onPress={() => void conOcupado(() => desasignarVehiculo(equipo.id))}>
                      Quitar asignación
                    </Button>
                  ) : null}
                </View>
              ) : null}
            </Card>
          ) : null}
          </>
        ) : null}

        {tab === "mantencion" ? (
          <>
          <Card>
            <Encabezado titulo="Plan de mantención preventiva">
              {puedeEditar ? <Accion texto="Agregar" color={marca.base} onPress={() => navigation.navigate("PlanMantencionForm", { equipoId: equipo.id })} /> : null}
            </Encabezado>
            {planes.length === 0 ? (
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
                Sin plan de mantención.
              </Texto>
            ) : (
              planes.map((p) => (
                <Pressable key={p.id} disabled={!puedeEditar || ocupado} onPress={() => opcionesPlan(p)} style={filaTocable}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Texto tamano={tokens.size.small} color={tokens.color.text}>
                      Cada {p.frecuencia_dias} días · próxima {fechaLegible(p.proxima_fecha)}
                    </Texto>
                    {p.notas ? (
                      <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} numberOfLines={2}>
                        {p.notas}
                      </Texto>
                    ) : null}
                  </View>
                  <StatusBadge estado={p.activo ? "activo" : "pausado"} etiqueta={p.activo ? "Activo" : "Pausado"} tonoForzado={p.activo ? "completado" : "cerrado"} />
                </Pressable>
              ))
            )}
          </Card>

          {vehiculo ? (
            <Card>
              <Encabezado titulo="Registros de mantención" />
              {registros.length === 0 ? (
                <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
                  Todavía no hay mantenciones registradas.
                </Texto>
              ) : (
                registros.map((r) => (
                  <Pressable key={r.id} onPress={() => navigation.navigate("MantencionDetalle", { equipoId: equipo.id, registroId: r.id })} style={filaTocable}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Texto tamano={tokens.size.small} color={tokens.color.text} numberOfLines={1}>
                        {r.tipo === "programa" ? "Programa (service)" : "Checklist diario"}
                        {r.realizado_por_nombre ? ` · ${r.realizado_por_nombre}` : ""}
                      </Texto>
                      <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
                        {fechaLegible(r.fecha)}
                      </Texto>
                    </View>
                    {r.con_novedades ? (
                      <StatusBadge estado="con_novedades" etiqueta="Novedades" tonoForzado="advertencia" />
                    ) : (
                      <StatusBadge estado="ok" etiqueta="OK" tonoForzado="completado" />
                    )}
                  </Pressable>
                ))
              )}
              <View style={{ gap: tokens.space["2"], marginTop: tokens.space["3"] }}>
                <Button variante="secundario" bloque iconoIzq={<Plus size={16} strokeWidth={2.5} color={tokens.color.text} />} onPress={registrarMantencion}>
                  Registrar mantención
                </Button>
                <Button variante="secundario" bloque onPress={() => navigation.navigate("MantencionHistorial", { equipoId: equipo.id, patente: equipo.patente ?? null })}>
                  Ver todo el historial
                </Button>
              </View>
            </Card>
          ) : null}
          </>
        ) : null}

        {tab === "actividad" ? (
          <Card>
            <Encabezado titulo="Actividad" />
            {incluirViajes && viajes === null ? (
              <LoadingState />
            ) : (
              <>
                {errorViajes ? (
                  <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["700"]} style={{ marginBottom: tokens.space["2"] }}>
                    {errorViajes}
                  </Texto>
                ) : null}
                {actividad.length === 0 ? (
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
                    Todavía no hay actividad para este equipo.
                  </Texto>
                ) : (
                  actividad.slice(0, 40).map((f) => (
                    <Pressable
                      key={f.clave}
                      onPress={() =>
                        f.tipo === "os"
                          ? navigation.navigate("Trabajos", { screen: "TrabajoDetalle", params: { trabajoId: f.id } })
                          : navigation.navigate("Viajes", { screen: "ViajeDetalle", params: { viajeId: f.id } })
                      }
                      style={filaTocable}
                    >
                      {f.tipo === "os" ? (
                        <ClipboardCheck size={18} strokeWidth={2.5} color={`${tokens.color.text}99`} />
                      ) : (
                        <Route size={18} strokeWidth={2.5} color={`${tokens.color.text}99`} />
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Texto tamano={tokens.size.small} color={tokens.color.text} numberOfLines={1}>
                          {f.titulo}
                        </Texto>
                        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} numberOfLines={1}>
                          {fechaLegible(f.fecha)}
                          {f.detalle ? ` · ${f.detalle}` : ""}
                        </Texto>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <StatusBadge estado={f.estado} />
                        {esSupervision && f.tipo === "viaje" && f.total != null ? (
                          <Texto tamano={tokens.size.caption} color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                            ${Math.round(Number(f.total)).toLocaleString("es-CL")}
                          </Texto>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )}
                {actividad.length > 40 ? (
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} style={{ marginTop: tokens.space["2"] }}>
                    y {actividad.length - 40} más — el historial completo está en la web.
                  </Texto>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        {tab === "documentos" ? (
          <>
          {vehiculo && puedeDocs ? (
            <Card>
              <Encabezado titulo="Documentos">
                <Accion texto="Subir" color={marca.base} onPress={() => navigation.navigate("DocumentoForm", { equipoId: equipo.id })} />
              </Encabezado>
              {errorDocs ? (
                <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["700"]}>
                  {errorDocs}
                </Texto>
              ) : documentos.length === 0 ? (
                <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
                  Este vehículo todavía no tiene documentos.
                </Texto>
              ) : (
                documentos.map((d) => (
                  <Pressable key={d.id} onPress={() => opcionesDocumento(d)} style={filaTocable}>
                    <FileText size={18} strokeWidth={2.5} color={`${tokens.color.text}99`} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Texto tamano={tokens.size.small} color={tokens.color.text} numberOfLines={1}>
                        {d.tipo?.nombre ?? "Documento"}
                        {d.numero ? ` · N° ${d.numero}` : ""}
                      </Texto>
                      <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
                        {d.fecha_vencimiento ? `Vence ${fechaLegible(d.fecha_vencimiento)}` : "Sin vencimiento"}
                        {d.archivo_key ? " · con archivo" : " · sin archivo"}
                      </Texto>
                    </View>
                    {d.estado ? <StatusBadge estado={d.estado} etiqueta={ETIQUETA_ESTADO_DOC[d.estado]} tonoForzado={TONO_ESTADO_DOC[d.estado]} /> : null}
                  </Pressable>
                ))
              )}
            </Card>
          ) : null}
          </>
        ) : null}

        {tab === "eventos" && vehiculo ? (
          <Card>
            <Encabezado titulo="Eventos de flota" />
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} style={{ marginBottom: tokens.space["3"] }}>
              Multas, choques, panas y otros eventos del vehículo, semana a semana.
            </Texto>
            <Button variante="secundario" bloque onPress={() => navigation.navigate("EventosFlota", { equipoId: equipo.id, patente: equipo.patente ?? null })}>
              Abrir eventos de flota
            </Button>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const filaTocable = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: tokens.space["3"],
  paddingVertical: tokens.space["3"],
  borderTopWidth: 1,
  borderTopColor: tokens.color.divider,
};

function Encabezado({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: tokens.space["2"] }}>
      <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
        {titulo}
      </Texto>
      {children}
    </View>
  );
}

function Accion({ texto, color, onPress }: { texto: string; color: string; onPress: () => void }) {
  return (
    <Pressable hitSlop={8} onPress={onPress} accessibilityRole="button">
      <Texto tamano={tokens.size.small} peso="semibold" color={color}>
        {texto}
      </Texto>
    </Pressable>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: tokens.space["3"], paddingVertical: tokens.space["1"] }}>
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
        {etiqueta}
      </Texto>
      <Texto tamano={tokens.size.small} color={tokens.color.text} style={{ flexShrink: 1, textAlign: "right" }}>
        {valor}
      </Texto>
    </View>
  );
}
