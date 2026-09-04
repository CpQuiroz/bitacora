import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useAuth } from "../auth/AuthContext";
import { listarTareasRango, type TareaConDatos } from "../../services/agenda";
import { esFeriado } from "../../lib/feriados";
import type { AgendaStackParamList } from "../../shell/navigation/types";

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
const DIAS_SEMANA_LUNES = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function lunesDe(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function sumarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const ACTIVAS = new Set(["pendiente", "confirmada"]);

type Modo = "semana" | "mes" | "planificacion";
// Se recuerda mientras la app siga abierta (no vale la pena persistir).
let ultimoModo: Modo = "mes";

export function AgendaScreen({ navigation }: NativeStackScreenProps<AgendaStackParamList, "AgendaLista">) {
  const t = useTema();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const hoy = new Date();
  const hoyKey = clave(hoy);

  const [modo, setModo] = useState<Modo>(ultimoModo);
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const [mesAncla, setMesAncla] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [diaSel, setDiaSel] = useState(hoyKey);
  const [tareas, setTareas] = useState<TareaConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  useEffect(() => {
    ultimoModo = modo;
  }, [modo]);

  // Rango de fechas a pedir según el modo.
  const { desde, hasta } = useMemo(() => {
    if (modo === "semana") {
      return { desde: clave(lunes), hasta: clave(sumarDias(lunes, 6)) };
    }
    if (modo === "mes") {
      // La grilla del mes muestra semanas completas (lun–dom): parte en
      // el lunes de la semana del día 1 y son 6 semanas.
      const inicioGrilla = lunesDe(mesAncla);
      return { desde: clave(inicioGrilla), hasta: clave(sumarDias(inicioGrilla, 41)) };
    }
    // planificación: desde hoy, 45 días hacia adelante.
    return { desde: hoyKey, hasta: clave(sumarDias(hoy, 45)) };
  }, [modo, lunes, mesAncla, hoyKey]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await listarTareasRango(desde, hasta);
      setTareas(r.tareas);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la agenda");
    }
  }, [desde, hasta]);

  useEffect(() => {
    setTareas(null);
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function onRefresh() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const porDia = useMemo(() => {
    const m = new Map<string, TareaConDatos[]>();
    for (const x of tareas ?? []) {
      if (!m.has(x.fecha)) m.set(x.fecha, []);
      m.get(x.fecha)!.push(x);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99"));
    return m;
  }, [tareas]);

  function irHoy() {
    setLunes(lunesDe(hoy));
    setMesAncla(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    setDiaSel(hoyKey);
  }

  if (tareas === null && !error) return <LoadingScreen />;
  if (error && !tareas) return <ErrorState mensaje={error} onReintentar={cargar} />;

  const abrirCita = (item: TareaConDatos) => navigation.navigate("TareaDetalle", { tareaId: item.id, titulo: item.titulo });
  const nuevaCita = (fecha?: string) =>
    navigation.navigate("NuevaCita", { fecha: fecha && fecha >= hoyKey ? fecha : undefined });

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />

      {/* Selector de modo */}
      <View style={{ flexDirection: "row", gap: t.espacio(2), padding: t.espacio(4), paddingBottom: t.espacio(3) }}>
        {([
          { k: "semana", label: "Semana" },
          { k: "mes", label: "Mes" },
          { k: "planificacion", label: "Planificación" },
        ] as const).map((o) => {
          const activo = o.k === modo;
          return (
            <Pressable
              key={o.k}
              onPress={() => setModo(o.k)}
              style={{
                flex: 1,
                minHeight: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: t.radio.md,
                backgroundColor: activo ? t.colores.brand : t.colores.surfaceAlt,
              }}
            >
              <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {modo === "semana" ? (
        <VistaSemana
          lunes={lunes}
          setLunes={setLunes}
          diaSel={diaSel}
          setDiaSel={setDiaSel}
          hoyKey={hoyKey}
          porDia={porDia}
          esGestion={esGestion}
          refrescando={refrescando}
          onRefresh={onRefresh}
          onAbrir={abrirCita}
          onNueva={nuevaCita}
          onHoy={irHoy}
        />
      ) : modo === "mes" ? (
        <VistaMes
          mesAncla={mesAncla}
          setMesAncla={setMesAncla}
          diaSel={diaSel}
          setDiaSel={setDiaSel}
          hoyKey={hoyKey}
          porDia={porDia}
          esGestion={esGestion}
          refrescando={refrescando}
          onRefresh={onRefresh}
          onAbrir={abrirCita}
          onNueva={nuevaCita}
          onHoy={irHoy}
        />
      ) : (
        <VistaPlanificacion
          desde={desde}
          hasta={hasta}
          hoyKey={hoyKey}
          porDia={porDia}
          esGestion={esGestion}
          refrescando={refrescando}
          onRefresh={onRefresh}
          onAbrir={abrirCita}
          onNueva={nuevaCita}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

type VistaProps = {
  diaSel: string;
  setDiaSel: (k: string) => void;
  hoyKey: string;
  porDia: Map<string, TareaConDatos[]>;
  esGestion: boolean;
  refrescando: boolean;
  onRefresh: () => void;
  onAbrir: (item: TareaConDatos) => void;
  onNueva: (fecha?: string) => void;
  onHoy: () => void;
};

function VistaSemana({
  lunes,
  setLunes,
  diaSel,
  setDiaSel,
  hoyKey,
  porDia,
  esGestion,
  refrescando,
  onRefresh,
  onAbrir,
  onNueva,
  onHoy,
}: VistaProps & { lunes: Date; setLunes: (fn: (l: Date) => Date) => void }) {
  const t = useTema();
  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);
  const citasDelDia = porDia.get(diaSel) ?? [];
  const dSel = new Date(diaSel + "T00:00:00");
  const tituloDia = diaSel === hoyKey ? "Hoy" : `${DIAS_LARGO[dSel.getDay()]} ${dSel.getDate()} de ${MESES[dSel.getMonth()]}`;
  const feriadoSel = esFeriado(diaSel);
  const mesRango =
    diasSemana[0].getMonth() === diasSemana[6].getMonth()
      ? `${MESES[diasSemana[0].getMonth()]} ${diasSemana[0].getFullYear()}`
      : `${MESES[diasSemana[0].getMonth()]} – ${MESES[diasSemana[6].getMonth()]}`;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: t.espacio(4), paddingTop: 0, gap: t.espacio(3), borderBottomWidth: 1, borderBottomColor: t.colores.border }}>
        <NavPeriodo
          titulo={mesRango}
          onPrev={() => setLunes((l) => sumarDias(l, -7))}
          onNext={() => setLunes((l) => sumarDias(l, 7))}
          onHoy={onHoy}
        />
        <View style={{ flexDirection: "row", gap: t.espacio(1.5) }}>
          {diasSemana.map((d) => {
            const k = clave(d);
            const sel = k === diaSel;
            const esHoy = k === hoyKey;
            const n = (porDia.get(k) ?? []).length;
            const feriado = Boolean(esFeriado(k));
            return (
              <Pressable
                key={k}
                onPress={() => setDiaSel(k)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: t.espacio(1.5),
                  borderRadius: t.radio.md,
                  backgroundColor: sel ? t.colores.brand : "transparent",
                  borderWidth: esHoy && !sel ? 1 : 0,
                  borderColor: t.colores.brand,
                }}
              >
                <Text variante="caption" tono={sel ? "inverso" : "muted"}>
                  {DIAS[d.getDay()]}
                </Text>
                <Text variante="subtitulo" tono={sel ? "inverso" : "normal"}>
                  {d.getDate()}
                </Text>
                <Puntos citas={n} feriado={feriado} sel={sel} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(3), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variante="subtitulo">{tituloDia}</Text>
          <Text variante="caption" tono="muted">
            {citasDelDia.length} {citasDelDia.length === 1 ? "cita" : "citas"}
          </Text>
        </View>
        {feriadoSel ? <ChipFeriado nombre={feriadoSel} /> : null}
        {citasDelDia.length === 0 ? (
          <EmptyState
            icono={<Ionicons name="calendar-outline" size={40} color={t.colores.faint} />}
            titulo="Sin citas este día"
            mensaje="Toca «Nueva cita» para agendar una."
          />
        ) : (
          citasDelDia.map((item) => <CitaCard key={item.id} item={item} esGestion={esGestion} onPress={() => onAbrir(item)} />)
        )}
      </ScrollView>

      <View style={{ padding: t.espacio(4), paddingTop: t.espacio(2) }}>
        <Button titulo="Nueva cita" onPress={() => onNueva(diaSel)} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function VistaMes({
  mesAncla,
  setMesAncla,
  diaSel,
  setDiaSel,
  hoyKey,
  porDia,
  esGestion,
  refrescando,
  onRefresh,
  onAbrir,
  onNueva,
  onHoy,
}: VistaProps & { mesAncla: Date; setMesAncla: (fn: (m: Date) => Date) => void }) {
  const t = useTema();
  const inicioGrilla = useMemo(() => lunesDe(mesAncla), [mesAncla]);
  const celdas = useMemo(() => Array.from({ length: 42 }, (_, i) => sumarDias(inicioGrilla, i)), [inicioGrilla]);
  const mesNum = mesAncla.getMonth();

  const citasDelDia = porDia.get(diaSel) ?? [];
  const dSel = new Date(diaSel + "T00:00:00");
  const tituloDia = diaSel === hoyKey ? "Hoy" : `${DIAS_LARGO[dSel.getDay()]} ${dSel.getDate()} de ${MESES[dSel.getMonth()]}`;
  const feriadoSel = esFeriado(diaSel);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: t.espacio(4) }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
    >
      <View style={{ padding: t.espacio(4), paddingTop: 0, gap: t.espacio(3) }}>
        <NavPeriodo
          titulo={`${MESES[mesNum]} ${mesAncla.getFullYear()}`}
          onPrev={() => setMesAncla((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          onNext={() => setMesAncla((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          onHoy={onHoy}
        />

        <View style={{ flexDirection: "row" }}>
          {DIAS_SEMANA_LUNES.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <Text variante="caption" tono="faint" weight="semibold">
                {d}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {celdas.map((d) => {
            const k = clave(d);
            const delMes = d.getMonth() === mesNum;
            const sel = k === diaSel;
            const esHoy = k === hoyKey;
            const n = (porDia.get(k) ?? []).length;
            const feriado = Boolean(esFeriado(k));
            return (
              <Pressable
                key={k}
                onPress={() => setDiaSel(k)}
                style={{
                  width: `${100 / 7}%`,
                  aspectRatio: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: t.espacio(1),
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: sel ? t.colores.brand : esHoy ? t.colores.brandSoft : "transparent",
                  }}
                >
                  <Text
                    variante="etiqueta"
                    weight={esHoy || sel ? "semibold" : "regular"}
                    tono={sel ? "inverso" : delMes ? "normal" : "faint"}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                <Puntos citas={n} feriado={feriado} sel={sel} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: t.colores.border }} />

      <View style={{ padding: t.espacio(4), gap: t.espacio(3) }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variante="subtitulo">{tituloDia}</Text>
          <Text variante="caption" tono="muted">
            {citasDelDia.length} {citasDelDia.length === 1 ? "cita" : "citas"}
          </Text>
        </View>
        {feriadoSel ? <ChipFeriado nombre={feriadoSel} /> : null}
        {citasDelDia.length === 0 ? (
          <EmptyState
            icono={<Ionicons name="calendar-outline" size={40} color={t.colores.faint} />}
            titulo="Sin citas este día"
            mensaje="Toca «Nueva cita» para agendar una."
          />
        ) : (
          citasDelDia.map((item) => <CitaCard key={item.id} item={item} esGestion={esGestion} onPress={() => onAbrir(item)} />)
        )}
        <Button titulo="Nueva cita" onPress={() => onNueva(diaSel)} style={{ marginTop: t.espacio(1) }} />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function VistaPlanificacion({
  desde,
  hasta,
  hoyKey,
  porDia,
  esGestion,
  refrescando,
  onRefresh,
  onAbrir,
  onNueva,
}: Omit<VistaProps, "diaSel" | "setDiaSel" | "onHoy"> & { desde: string; hasta: string }) {
  const t = useTema();

  // Días con citas dentro del rango, ordenados.
  const dias = useMemo(() => {
    return [...porDia.keys()]
      .filter((k) => k >= desde && k <= hasta)
      .sort()
      .map((k) => ({ k, citas: porDia.get(k)! }));
  }, [porDia, desde, hasta]);

  const etiquetaDia = (k: string) => {
    const d = new Date(k + "T00:00:00");
    const manana = clave(sumarDias(new Date(hoyKey + "T00:00:00"), 1));
    if (k === hoyKey) return "Hoy";
    if (k === manana) return "Mañana";
    return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: t.espacio(4), paddingTop: t.espacio(2), gap: t.espacio(4), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
      >
        <Text variante="caption" tono="muted">
          Próximos 45 días
        </Text>
        {dias.length === 0 ? (
          <EmptyState
            icono={<Ionicons name="calendar-outline" size={40} color={t.colores.faint} />}
            titulo="Nada agendado"
            mensaje="No tienes citas en los próximos 45 días."
          />
        ) : (
          dias.map(({ k, citas }) => {
            const feriado = esFeriado(k);
            return (
              <View key={k} style={{ gap: t.espacio(2) }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
                  <Text variante="etiqueta" weight="semibold" style={{ textTransform: "capitalize" }}>
                    {etiquetaDia(k)}
                  </Text>
                  {feriado ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colores.success }} />
                  ) : null}
                </View>
                {feriado ? (
                  <Text variante="caption" tono="success">
                    {feriado}
                  </Text>
                ) : null}
                {citas.map((item) => (
                  <CitaCard key={item.id} item={item} esGestion={esGestion} onPress={() => onAbrir(item)} />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={{ padding: t.espacio(4), paddingTop: t.espacio(2) }}>
        <Button titulo="Nueva cita" onPress={() => onNueva()} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function NavPeriodo({ titulo, onPrev, onNext, onHoy }: { titulo: string; onPrev: () => void; onNext: () => void; onHoy: () => void }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable onPress={onPrev} hitSlop={10} style={{ padding: t.espacio(1) }}>
        <Ionicons name="chevron-back" size={22} color={t.colores.foreground} />
      </Pressable>
      <Pressable onPress={onHoy} hitSlop={10}>
        <Text variante="etiqueta" weight="semibold" style={{ textTransform: "capitalize" }}>
          {titulo}
        </Text>
      </Pressable>
      <Pressable onPress={onNext} hitSlop={10} style={{ padding: t.espacio(1) }}>
        <Ionicons name="chevron-forward" size={22} color={t.colores.foreground} />
      </Pressable>
    </View>
  );
}

function Puntos({ citas, feriado, sel }: { citas: number; feriado: boolean; sel: boolean }) {
  const t = useTema();
  const azul = sel ? t.colores.brandForeground : t.colores.brand;
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 3, height: 5, alignItems: "center" }}>
      {citas > 0 ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: azul }} /> : null}
      {feriado ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colores.success }} /> : null}
    </View>
  );
}

function ChipFeriado({ nombre }: { nombre: string }) {
  const t = useTema();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.espacio(2),
        alignSelf: "flex-start",
        backgroundColor: t.colores.successSoft,
        paddingHorizontal: t.espacio(3),
        paddingVertical: t.espacio(1.5),
        borderRadius: t.radio.full,
      }}
    >
      <Ionicons name="flag" size={13} color={t.colores.success} />
      <Text variante="caption" weight="semibold" tono="success">
        Feriado · {nombre}
      </Text>
    </View>
  );
}

function CitaCard({ item, esGestion, onPress }: { item: TareaConDatos; esGestion: boolean; onPress: () => void }) {
  const t = useTema();
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
        <View style={{ flex: 1, gap: t.espacio(1) }}>
          <Text variante="subtitulo">{item.titulo}</Text>
          <Text variante="etiqueta" tono="muted">
            {item.hora ? item.hora.slice(0, 5) : "Sin hora"}
            {item.cliente?.nombre ? ` · ${item.cliente.nombre}` : ""}
          </Text>
          {esGestion && item.responsable?.nombre ? (
            <Text variante="caption" tono="muted">
              Atiende: {item.responsable.nombre}
            </Text>
          ) : null}
          {item.paquete_id ? (
            <Text variante="caption" tono="muted">
              Sesión de paquete
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Badge estado={item.estado} />
          {item.prioridad === "alta" && ACTIVAS.has(item.estado) ? (
            <Text variante="caption" weight="semibold" tono="danger">
              Prioridad alta
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
