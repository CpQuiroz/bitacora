import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { ArrowLeft, FileText, Plus } from "lucide-react-native";
import type { PlanMantencion, Usuario } from "@bitacora/shared";
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
  obtenerEquipo,
  planesDeEquipo,
  urlArchivoDocumento,
  type DocumentoConTipo,
  type EquipoDetalle,
} from "../../services/equipos";
import { permisosEquipos } from "./permisos";
import { fechaLegible } from "./fechas";

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
    } catch (x) {
      setError(x instanceof Error ? x.message : "No se pudo cargar");
    }
    // permisos se recalcula en cada render; basta con sus valores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId, miId, permisos.flota, permisos.asignar]);

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

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo={vehiculo ? (equipo.patente ?? "Vehículo") : (equipo.categoria ?? "Equipo")} titulo={equipo.nombre} accion={volver} />
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
            <Encabezado titulo="Mantención y eventos" />
            <View style={{ gap: tokens.space["2"] }}>
              <Button variante="secundario" bloque iconoIzq={<Plus size={16} strokeWidth={2.5} color={tokens.color.text} />} onPress={registrarMantencion}>
                Registrar mantención
              </Button>
              <Button variante="secundario" bloque onPress={() => navigation.navigate("MantencionHistorial", { equipoId: equipo.id, patente: equipo.patente ?? null })}>
                Historial de mantenciones
              </Button>
              <Button variante="secundario" bloque onPress={() => navigation.navigate("EventosFlota", { equipoId: equipo.id, patente: equipo.patente ?? null })}>
                Eventos de flota
              </Button>
            </View>
          </Card>
        ) : null}

        <Card>
          <Encabezado titulo="Historial de OS" />
          {historial.length === 0 ? (
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
              Sin órdenes de servicio asociadas a este equipo.
            </Texto>
          ) : (
            historial.slice(0, 15).map((t) => (
              <View key={t.id} style={filaTocable}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto tamano={tokens.size.small} color={tokens.color.text} numberOfLines={1}>
                    {t.orden?.folio != null ? `OS N° ${t.orden.folio}` : t.descripcion || "Sin folio"}
                  </Texto>
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
                    {fechaLegible(t.fecha)}
                  </Texto>
                </View>
                <StatusBadge estado={t.orden?.estado_os ?? t.estado} />
              </View>
            ))
          )}
          {historial.length > 15 ? (
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} style={{ marginTop: tokens.space["2"] }}>
              y {historial.length - 15} más — el historial completo está en la web.
            </Texto>
          ) : null}
        </Card>
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
