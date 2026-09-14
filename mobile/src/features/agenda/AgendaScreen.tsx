import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { ChevronLeft, ChevronRight, Plus, CalendarX2 } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoTarea } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import {
  AsistenteButton,
  EmptyState,
  ErrorState,
  ESPACIO_ASISTENTE_FLOTANTE,
  LoadingState,
  ScreenHeader,
  Texto,
  useMarca,
  type Marca,
} from "@bitacora/ui/native";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useAuth } from "../auth/AuthContext";
import { listarTareasRango, type TareaConDatos } from "../../services/agenda";
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

// Mismos 4 estados visuales que ya usa el sistema v2 para OS
// (en_progreso/completado/cerrado — ver MAPA_ESTADO_TONO): ninguno es
// rojo/verde literal, el sistema nuevo evita semáforo y usa acento/
// acento2/neutral. "pendiente" (agendada, sin confirmar) es la única
// que no encaja en esos 3 — se queda con el color de marca, igual que
// antes usaba t.colores.brand: es la que necesita acción.
function colorEstado(estado: EstadoTarea, marca: Marca): string {
  if (estado === "completada") return tokens.color.accent2Ramp["700"];
  if (estado === "cancelada" || estado === "no_asistio" || estado === "cancelada_anticipada") return tokens.color.neutral["500"];
  if (estado === "confirmada") return tokens.color.accentRamp["700"];
  return marca.base;
}

type Modo = "mes" | "semana" | "dia";
let ultimoModo: Modo = "mes";

const HORA_ALTO = 54;
const HORA_INI = 7;
const HORA_FIN = 21;

// Sistema visual móvil v2 (14-sep-2026) — ScreenHeader (título + chips
// Mes/Sem/Día, mismo patrón que Míos/Equipo en Hoy) + AsistenteButton.
// El FAB de "nueva cita" se mueve a la izquierda (antes compartía la
// esquina de abajo a la derecha con el Asistente, que ahora vive ahí en
// las 4 pestañas) — misma altura, mismo tamaño de toque, solo espejado.
export function AgendaScreen({ navigation }: NativeStackScreenProps<AgendaStackParamList, "AgendaLista">) {
  const marca = useMarca();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const veAsistente = auth.fase === "listo" && auth.modulosVisibles.includes("asistente");

  const hoy = new Date();
  const hoyKey = clave(hoy);

  const [modo, setModo] = useState<Modo>(ultimoModo);
  const [ancla, setAncla] = useState(hoyKey);
  const [tareas, setTareas] = useState<TareaConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  useEffect(() => {
    ultimoModo = modo;
  }, [modo]);

  const anclaDate = useMemo(() => new Date(ancla + "T00:00:00"), [ancla]);

  const { desde, hasta, diasDelRango } = useMemo(() => {
    if (modo === "dia") return { desde: ancla, hasta: ancla, diasDelRango: [anclaDate] };
    if (modo === "semana") {
      const l = lunesDe(anclaDate);
      const dias = Array.from({ length: 7 }, (_, i) => sumarDias(l, i));
      return { desde: clave(dias[0]), hasta: clave(dias[6]), diasDelRango: dias };
    }
    const primero = new Date(anclaDate.getFullYear(), anclaDate.getMonth(), 1);
    const ultimo = new Date(anclaDate.getFullYear(), anclaDate.getMonth() + 1, 0);
    const dias = Array.from({ length: ultimo.getDate() }, (_, i) => new Date(primero.getFullYear(), primero.getMonth(), i + 1));
    return { desde: clave(primero), hasta: clave(ultimo), diasDelRango: dias };
  }, [modo, ancla, anclaDate]);

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

  function mover(delta: number) {
    if (modo === "dia") setAncla(clave(sumarDias(anclaDate, delta)));
    else if (modo === "semana") setAncla(clave(sumarDias(anclaDate, delta * 7)));
    else setAncla(clave(new Date(anclaDate.getFullYear(), anclaDate.getMonth() + delta, 1)));
  }

  const titulo = useMemo(() => {
    if (modo === "dia") {
      if (ancla === hoyKey) return "Hoy";
      return `${DIAS_LARGO[anclaDate.getDay()]} ${anclaDate.getDate()} ${MESES[anclaDate.getMonth()]}`;
    }
    if (modo === "semana") {
      const l = lunesDe(anclaDate);
      const dom = sumarDias(l, 6);
      if (l.getMonth() === dom.getMonth()) return `${l.getDate()}–${dom.getDate()} ${MESES[l.getMonth()]}`;
      return `${l.getDate()} ${MESES[l.getMonth()].slice(0, 3)} – ${dom.getDate()} ${MESES[dom.getMonth()].slice(0, 3)}`;
    }
    return `${MESES[anclaDate.getMonth()]} ${anclaDate.getFullYear()}`;
  }, [modo, ancla, anclaDate, hoyKey]);

  const abrirCita = (item: TareaConDatos) => navigation.navigate("TareaDetalle", { tareaId: item.id, titulo: item.titulo });
  const nuevaCita = (fecha?: string) => navigation.navigate("NuevaCita", { fecha: fecha && fecha >= hoyKey ? fecha : undefined });
  const verDia = (k: string) => {
    setAncla(k);
    setModo("dia");
  };

  const filtrosModo = {
    opciones: [
      { valor: "mes", etiqueta: "Mes" },
      { valor: "semana", etiqueta: "Sem" },
      { valor: "dia", etiqueta: "Día" },
    ],
    valor: modo,
    onCambio: (v: string) => setModo(v as Modo),
  };

  if (tareas === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo=" " titulo="Agenda" filtros={filtrosModo} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !tareas) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo=" " titulo="Agenda" filtros={filtrosModo} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo=" " titulo="Agenda" filtros={filtrosModo} />
      <OfflineBanner guardadoEn={guardadoEn} />

      {/* Navegación de período — fila propia debajo de ScreenHeader; el
          título es interactivo (toca para volver a hoy), ScreenHeader
          solo admite texto plano en su propio título. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.space["3"],
          paddingVertical: tokens.space["2"],
        }}
      >
        <Pressable onPress={() => mover(-1)} hitSlop={10}>
          <ChevronLeft size={22} color={tokens.color.text} />
        </Pressable>
        <Pressable onPress={() => setAncla(hoyKey)} hitSlop={8}>
          <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text} style={{ textTransform: "capitalize" }}>
            {titulo}
          </Texto>
        </Pressable>
        <Pressable onPress={() => mover(1)} hitSlop={10}>
          <ChevronRight size={22} color={tokens.color.text} />
        </Pressable>
      </View>

      {modo === "mes" ? (
        <VistaMes
          anclaDate={anclaDate}
          hoyKey={hoyKey}
          anclaKey={ancla}
          porDia={porDia}
          onDia={(k) => setAncla(k)}
          onCita={abrirCita}
          esGestion={esGestion}
          refrescando={refrescando}
          onRefresh={onRefresh}
          marca={marca}
        />
      ) : modo === "semana" ? (
        <VistaSemana
          dias={diasDelRango}
          hoyKey={hoyKey}
          porDia={porDia}
          onDia={verDia}
          onCita={abrirCita}
          esGestion={esGestion}
          refrescando={refrescando}
          onRefresh={onRefresh}
          marca={marca}
        />
      ) : (
        <VistaDia anclaDate={anclaDate} anclaKey={ancla} hoyKey={hoyKey} citas={porDia.get(ancla) ?? []} onDia={(k) => setAncla(k)} onCita={abrirCita} marca={marca} />
      )}

      <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />

      {/* FAB de nueva cita — a la izquierda: la derecha ya es del
          Asistente en las 4 pestañas, mismo alto/offset, espejado. */}
      <Pressable
        onPress={() => nuevaCita(modo === "dia" ? ancla : undefined)}
        style={{
          position: "absolute",
          left: 18,
          bottom: 110,
          width: 50,
          height: 50,
          borderRadius: tokens.radius.pill,
          backgroundColor: marca.base,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: marca.base,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Plus size={26} color={marca.foreground} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

function BarrasDia({ citas, marca }: { citas: TareaConDatos[]; marca: Marca }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 3, height: 4 }}>
      {citas.slice(0, 3).map((c) => (
        <View key={c.id} style={{ width: 10, height: 4, borderRadius: 1, backgroundColor: colorEstado(c.estado, marca) }} />
      ))}
    </View>
  );
}

function VistaMes({
  anclaDate,
  hoyKey,
  anclaKey,
  porDia,
  onDia,
  onCita,
  esGestion,
  refrescando,
  onRefresh,
  marca,
}: {
  anclaDate: Date;
  hoyKey: string;
  anclaKey: string;
  porDia: Map<string, TareaConDatos[]>;
  onDia: (k: string) => void;
  onCita: (c: TareaConDatos) => void;
  esGestion: boolean;
  refrescando: boolean;
  onRefresh: () => void;
  marca: Marca;
}) {
  const mesNum = anclaDate.getMonth();
  const inicioGrilla = useMemo(() => lunesDe(new Date(anclaDate.getFullYear(), anclaDate.getMonth(), 1)), [anclaDate]);
  const semanas = useMemo(() => {
    const finMes = new Date(anclaDate.getFullYear(), anclaDate.getMonth() + 1, 0);
    const dias = Math.round((finMes.getTime() - inicioGrilla.getTime()) / 86400000) + 1;
    return Math.ceil(dias / 7);
  }, [anclaDate, inicioGrilla]);
  const celdas = useMemo(() => Array.from({ length: semanas * 7 }, (_, i) => sumarDias(inicioGrilla, i)), [inicioGrilla, semanas]);

  const delDia = porDia.get(anclaKey) ?? [];
  const d = new Date(anclaKey + "T00:00:00");

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: ESPACIO_ASISTENTE_FLOTANTE }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} />}
    >
      <View style={{ paddingHorizontal: tokens.space["4"], paddingBottom: tokens.space["3"], borderBottomWidth: 1, borderBottomColor: tokens.color.divider }}>
        <View style={{ flexDirection: "row", marginBottom: 4 }}>
          {DIAS_SEMANA_LUNES.map((dl, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <Texto tamano={tokens.size.caption} peso="semibold" color={tokens.color.text + "66"} style={{ fontVariant: ["tabular-nums"] }}>
                {dl}
              </Texto>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {celdas.map((cd) => {
            const k = clave(cd);
            const delMes = cd.getMonth() === mesNum;
            const esHoy = k === hoyKey;
            const sel = k === anclaKey;
            return (
              <Pressable
                key={k}
                onPress={() => onDia(k)}
                style={{
                  width: `${100 / 7}%`,
                  height: 52,
                  alignItems: "center",
                  paddingTop: 4,
                  backgroundColor: esHoy ? tokens.color.surface : "transparent",
                  borderWidth: sel && !esHoy ? 1 : 0,
                  borderColor: marca.base,
                  borderRadius: tokens.radius.sm,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: esHoy ? 4 : 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: esHoy ? marca.base : "transparent",
                  }}
                >
                  <Texto
                    tamano={tokens.size.caption}
                    peso={esHoy ? "semibold" : "regular"}
                    color={esHoy ? marca.foreground : delMes ? tokens.color.text : tokens.color.text + "55"}
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {cd.getDate()}
                  </Texto>
                </View>
                <BarrasDia citas={porDia.get(k) ?? []} marca={marca} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Lista del día seleccionado */}
      <View style={{ padding: tokens.space["4"], gap: tokens.space["2"] }}>
        <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text} style={{ textTransform: "capitalize" }}>
          {anclaKey === hoyKey ? "Hoy" : `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`}
        </Texto>
        {delDia.length === 0 ? (
          <Texto tamano={tokens.size.small} color={tokens.color.text + "99"}>
            Sin citas este día.
          </Texto>
        ) : (
          delDia.map((c) => <FilaCita key={c.id} item={c} esGestion={esGestion} onPress={() => onCita(c)} marca={marca} />)
        )}
      </View>
    </ScrollView>
  );
}

function VistaSemana({
  dias,
  hoyKey,
  porDia,
  onDia,
  onCita,
  esGestion,
  refrescando,
  onRefresh,
  marca,
}: {
  dias: Date[];
  hoyKey: string;
  porDia: Map<string, TareaConDatos[]>;
  onDia: (k: string) => void;
  onCita: (c: TareaConDatos) => void;
  esGestion: boolean;
  refrescando: boolean;
  onRefresh: () => void;
  marca: Marca;
}) {
  const conCitas = dias.map(clave).filter((k) => (porDia.get(k)?.length ?? 0) > 0);
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          gap: tokens.space["1"] * 1.5,
          paddingHorizontal: tokens.space["4"],
          paddingBottom: tokens.space["3"],
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.divider,
        }}
      >
        {dias.map((d) => {
          const k = clave(d);
          const esHoy = k === hoyKey;
          return (
            <Pressable
              key={k}
              onPress={() => onDia(k)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: tokens.space["1"] * 1.5,
                borderRadius: tokens.radius.sm,
                borderWidth: esHoy ? 1 : 0,
                borderColor: marca.base,
              }}
            >
              <Texto tamano={tokens.size.caption} color={tokens.color.text + "99"}>
                {DIAS[d.getDay()]}
              </Texto>
              <Texto tamano={tokens.size.h5} color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                {d.getDate()}
              </Texto>
              <BarrasDia citas={porDia.get(k) ?? []} marca={marca} />
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: tokens.space["4"], paddingBottom: ESPACIO_ASISTENTE_FLOTANTE, gap: tokens.space["4"] }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} />}
      >
        {conCitas.length === 0 ? (
          <EmptyState icono={<CalendarX2 size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />} titulo="Sin citas esta semana" mensaje="Toca + para agendar una." />
        ) : (
          conCitas.map((k) => {
            const d = new Date(k + "T00:00:00");
            return (
              <View key={k} style={{ gap: tokens.space["2"] }}>
                <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text} style={{ textTransform: "capitalize" }}>
                  {k === hoyKey ? "Hoy" : `${DIAS_LARGO[d.getDay()].slice(0, 3)} ${d.getDate()}`}
                </Texto>
                {porDia.get(k)!.map((c) => (
                  <FilaCita key={c.id} item={c} esGestion={esGestion} onPress={() => onCita(c)} marca={marca} />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

function VistaDia({
  anclaDate,
  anclaKey,
  hoyKey,
  citas,
  onDia,
  onCita,
  marca,
}: {
  anclaDate: Date;
  anclaKey: string;
  hoyKey: string;
  citas: TareaConDatos[];
  onDia: (k: string) => void;
  onCita: (c: TareaConDatos) => void;
  marca: Marca;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const seisDias = useMemo(() => Array.from({ length: 6 }, (_, i) => sumarDias(anclaDate, i - 2)), [anclaDate]);
  const ahora = new Date();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const topAhora = ((minutosAhora - HORA_INI * 60) / 60) * HORA_ALTO;

  useEffect(() => {
    const y = Math.max(0, topAhora - 120);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 60);
    return () => clearTimeout(id);
  }, [topAhora, anclaKey]);

  const horas = Array.from({ length: HORA_FIN - HORA_INI + 1 }, (_, i) => HORA_INI + i);

  return (
    <View style={{ flex: 1 }}>
      {/* Tira de 6 días */}
      <View
        style={{
          flexDirection: "row",
          gap: tokens.space["1"] * 1.5,
          paddingHorizontal: tokens.space["4"],
          paddingBottom: tokens.space["3"],
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.divider,
        }}
      >
        {seisDias.map((d) => {
          const k = clave(d);
          const sel = k === anclaKey;
          return (
            <Pressable
              key={k}
              onPress={() => onDia(k)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: tokens.space["1"] * 1.5,
                borderRadius: tokens.radius.sm,
                backgroundColor: sel ? marca.base : "transparent",
              }}
            >
              <Texto tamano={tokens.size.caption} color={sel ? marca.foreground : tokens.color.text + "99"}>
                {DIAS[d.getDay()]}
              </Texto>
              <Texto tamano={16} peso="semibold" color={sel ? marca.foreground : tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                {d.getDate()}
              </Texto>
            </Pressable>
          );
        })}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: ESPACIO_ASISTENTE_FLOTANTE }}>
        <View style={{ position: "relative", marginTop: tokens.space["2"] }}>
          {horas.map((h, i) => (
            <View key={h} style={{ position: "absolute", top: i * HORA_ALTO, left: 0, right: 0, height: HORA_ALTO, borderTopWidth: 1, borderTopColor: tokens.color.divider }}>
              <Texto
                tamano={tokens.size.caption}
                color={tokens.color.text + "55"}
                style={{ marginLeft: tokens.space["2"], marginTop: -7, fontVariant: ["tabular-nums"] }}
              >
                {String(h).padStart(2, "0")}:00
              </Texto>
            </View>
          ))}
          <View style={{ height: horas.length * HORA_ALTO }} />

          {/* Bloques de citas */}
          {citas.map((c) => {
            if (!c.hora) return null;
            const [hh, mm] = c.hora.slice(0, 5).split(":").map(Number);
            const inicioMin = hh * 60 + mm;
            const dur = c.duracion_min || 45;
            const top = ((inicioMin - HORA_INI * 60) / 60) * HORA_ALTO;
            const alto = Math.max(22, (dur / 60) * HORA_ALTO);
            const compacto = alto < 60;
            return (
              <Pressable
                key={c.id}
                onPress={() => onCita(c)}
                style={{
                  position: "absolute",
                  top,
                  left: 56,
                  right: tokens.space["4"],
                  height: alto - 3,
                  backgroundColor: tokens.color.surface,
                  borderRadius: tokens.radius.sm,
                  borderWidth: 1,
                  borderColor: tokens.color.divider,
                  borderLeftWidth: 3,
                  borderLeftColor: colorEstado(c.estado, marca),
                  paddingHorizontal: tokens.space["2"],
                  paddingVertical: 3,
                  overflow: "hidden",
                }}
              >
                {compacto ? (
                  <Texto tamano={tokens.size.caption} color={tokens.color.text} numberOfLines={1}>
                    <Texto tamano={tokens.size.caption} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                      {c.hora.slice(0, 5)}{" "}
                    </Texto>
                    {c.titulo}
                    {c.cliente?.nombre ? ` · ${c.cliente.nombre}` : ""}
                  </Texto>
                ) : (
                  <>
                    <Texto tamano={tokens.size.caption} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                      {c.hora.slice(0, 5)}
                    </Texto>
                    <Texto tamano={tokens.size.caption} peso="semibold" color={tokens.color.text} numberOfLines={1}>
                      {c.titulo}
                    </Texto>
                    {c.cliente?.nombre ? (
                      <Texto tamano={tokens.size.caption} color={tokens.color.text + "99"} numberOfLines={1}>
                        {c.cliente.nombre}
                      </Texto>
                    ) : null}
                  </>
                )}
              </Pressable>
            );
          })}

          {/* Línea de "ahora" */}
          {anclaKey === hoyKey && topAhora >= 0 && topAhora <= horas.length * HORA_ALTO ? (
            <View style={{ position: "absolute", top: topAhora, left: 0, right: 0, flexDirection: "row", alignItems: "center" }}>
              <Texto
                tamano={tokens.size.caption}
                peso="semibold"
                color={tokens.color.accent}
                style={{ width: 52, textAlign: "right", marginRight: 2, fontVariant: ["tabular-nums"] }}
              >
                {String(ahora.getHours()).padStart(2, "0")}:{String(ahora.getMinutes()).padStart(2, "0")}
              </Texto>
              <View style={{ flex: 1, height: 1.5, backgroundColor: tokens.color.accent }} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function FilaCita({ item, esGestion, onPress, marca }: { item: TareaConDatos; esGestion: boolean; onPress: () => void; marca: Marca }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.space["3"],
        paddingVertical: tokens.space["2"] * 1.25,
        borderBottomWidth: 1,
        borderBottomColor: tokens.color.divider,
      }}
    >
      <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text} style={{ width: 46, fontVariant: ["tabular-nums"] }}>
        {item.hora ? item.hora.slice(0, 5) : "--:--"}
      </Texto>
      <View style={{ flex: 1 }}>
        <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text} numberOfLines={1}>
          {item.titulo}
        </Texto>
        <Texto tamano={tokens.size.small} color={tokens.color.text + "99"} numberOfLines={1}>
          {item.cliente?.nombre ?? "Sin cliente"}
          {esGestion && item.responsable?.nombre ? ` · ${item.responsable.nombre}` : ""}
        </Texto>
      </View>
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: colorEstado(item.estado, marca) }} />
    </Pressable>
  );
}
