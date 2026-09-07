import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoTarea } from "@bitacora/shared";
import { useTema, type Tema } from "../../theme";
import { EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
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

function colorEstado(estado: EstadoTarea, t: Tema): string {
  if (estado === "completada") return t.colores.success;
  if (estado === "cancelada" || estado === "no_asistio" || estado === "cancelada_anticipada") return t.colores.danger;
  if (estado === "confirmada") return t.colores.accent;
  return t.colores.brand; // pendiente → agendado
}

type Modo = "mes" | "semana" | "dia";
let ultimoModo: Modo = "mes";

const HORA_ALTO = 54;
const HORA_INI = 7;
const HORA_FIN = 21;

export function AgendaScreen({ navigation }: NativeStackScreenProps<AgendaStackParamList, "AgendaLista">) {
  const t = useTema();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

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

  if (tareas === null && !error) return <LoadingScreen />;
  if (error && !tareas) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />

      {/* Navegación de período + selector arriba a la derecha */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: t.espacio(4),
          paddingTop: t.espacio(3),
          paddingBottom: t.espacio(3),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(1) }}>
          <Pressable onPress={() => mover(-1)} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={t.colores.foreground} />
          </Pressable>
          <Pressable onPress={() => setAncla(hoyKey)} hitSlop={8}>
            <Text weight="semibold" style={{ textTransform: "capitalize", fontSize: 16 }}>
              {titulo}
            </Text>
          </Pressable>
          <Pressable onPress={() => mover(1)} hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color={t.colores.foreground} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.sm, overflow: "hidden" }}>
          {(["mes", "semana", "dia"] as const).map((m) => {
            const activo = m === modo;
            return (
              <Pressable
                key={m}
                onPress={() => setModo(m)}
                style={{ paddingHorizontal: t.espacio(2.5), paddingVertical: t.espacio(1.5), backgroundColor: activo ? t.colores.brand : t.colores.surface }}
              >
                <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
                  {m === "mes" ? "Mes" : m === "semana" ? "Sem" : "Día"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {modo === "mes" ? (
        <VistaMes anclaDate={anclaDate} hoyKey={hoyKey} anclaKey={ancla} porDia={porDia} onDia={(k) => setAncla(k)} onCita={abrirCita} esGestion={esGestion} refrescando={refrescando} onRefresh={onRefresh} />
      ) : modo === "semana" ? (
        <VistaSemana dias={diasDelRango} hoyKey={hoyKey} porDia={porDia} onDia={verDia} onCita={abrirCita} esGestion={esGestion} refrescando={refrescando} onRefresh={onRefresh} />
      ) : (
        <VistaDia anclaDate={anclaDate} anclaKey={ancla} hoyKey={hoyKey} citas={porDia.get(ancla) ?? []} onDia={(k) => setAncla(k)} onCita={abrirCita} />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => nuevaCita(modo === "dia" ? ancla : undefined)}
        style={{
          position: "absolute",
          right: t.espacio(5),
          bottom: t.espacio(6),
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: t.colores.brand,
          alignItems: "center",
          justifyContent: "center",
          ...t.sombra.flotante,
        }}
      >
        <Ionicons name="add" size={26} color={t.colores.brandForeground} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

function BarrasDia({ citas }: { citas: TareaConDatos[] }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 3, height: 4 }}>
      {citas.slice(0, 3).map((c) => (
        <View key={c.id} style={{ width: 10, height: 4, borderRadius: 1, backgroundColor: colorEstado(c.estado, t) }} />
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
}) {
  const t = useTema();
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
    <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}>
      <View style={{ paddingHorizontal: t.espacio(4), paddingBottom: t.espacio(3), borderBottomWidth: 1, borderBottomColor: t.colores.border }}>
        <View style={{ flexDirection: "row", marginBottom: 4 }}>
          {DIAS_SEMANA_LUNES.map((dl, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <Text mono variante="caption" tono="faint" weight="semibold">
                {dl}
              </Text>
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
                  backgroundColor: esHoy ? "#F3F6F9" : "transparent",
                  borderWidth: sel && !esHoy ? 1 : 0,
                  borderColor: t.colores.brand,
                  borderRadius: t.radio.sm,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: esHoy ? 4 : 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: esHoy ? t.colores.brand : "transparent",
                  }}
                >
                  <Text mono variante="caption" weight={esHoy ? "semibold" : "regular"} tono={esHoy ? "inverso" : delMes ? "normal" : "faint"}>
                    {cd.getDate()}
                  </Text>
                </View>
                <BarrasDia citas={porDia.get(k) ?? []} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Lista del día seleccionado */}
      <View style={{ padding: t.espacio(4), gap: t.espacio(2) }}>
        <Text weight="semibold" style={{ textTransform: "capitalize" }}>
          {anclaKey === hoyKey ? "Hoy" : `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`}
        </Text>
        {delDia.length === 0 ? (
          <Text variante="caption" tono="muted">
            Sin citas este día.
          </Text>
        ) : (
          delDia.map((c) => <FilaCita key={c.id} item={c} esGestion={esGestion} onPress={() => onCita(c)} />)
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
}: {
  dias: Date[];
  hoyKey: string;
  porDia: Map<string, TareaConDatos[]>;
  onDia: (k: string) => void;
  onCita: (c: TareaConDatos) => void;
  esGestion: boolean;
  refrescando: boolean;
  onRefresh: () => void;
}) {
  const t = useTema();
  const conCitas = dias.map(clave).filter((k) => (porDia.get(k)?.length ?? 0) > 0);
  return (
    <>
      <View style={{ flexDirection: "row", gap: t.espacio(1.5), paddingHorizontal: t.espacio(4), paddingBottom: t.espacio(3), borderBottomWidth: 1, borderBottomColor: t.colores.border }}>
        {dias.map((d) => {
          const k = clave(d);
          const esHoy = k === hoyKey;
          return (
            <Pressable key={k} onPress={() => onDia(k)} style={{ flex: 1, alignItems: "center", paddingVertical: t.espacio(1.5), borderRadius: t.radio.sm, borderWidth: esHoy ? 1 : 0, borderColor: t.colores.brand }}>
              <Text variante="caption" tono="muted">
                {DIAS[d.getDay()]}
              </Text>
              <Text mono variante="subtitulo">
                {d.getDate()}
              </Text>
              <BarrasDia citas={porDia.get(k) ?? []} />
            </Pressable>
          );
        })}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(4) }} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}>
        {conCitas.length === 0 ? (
          <EmptyState icono={<Ionicons name="calendar-outline" size={40} color={t.colores.faint} />} titulo="Sin citas esta semana" mensaje="Toca + para agendar una." />
        ) : (
          conCitas.map((k) => {
            const d = new Date(k + "T00:00:00");
            return (
              <View key={k} style={{ gap: t.espacio(2) }}>
                <Text weight="semibold" style={{ textTransform: "capitalize" }}>
                  {k === hoyKey ? "Hoy" : `${DIAS_LARGO[d.getDay()].slice(0, 3)} ${d.getDate()}`}
                </Text>
                {porDia.get(k)!.map((c) => (
                  <FilaCita key={c.id} item={c} esGestion={esGestion} onPress={() => onCita(c)} />
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
}: {
  anclaDate: Date;
  anclaKey: string;
  hoyKey: string;
  citas: TareaConDatos[];
  onDia: (k: string) => void;
  onCita: (c: TareaConDatos) => void;
}) {
  const t = useTema();
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
      <View style={{ flexDirection: "row", gap: t.espacio(1.5), paddingHorizontal: t.espacio(4), paddingBottom: t.espacio(3), borderBottomWidth: 1, borderBottomColor: t.colores.border }}>
        {seisDias.map((d) => {
          const k = clave(d);
          const sel = k === anclaKey;
          return (
            <Pressable key={k} onPress={() => onDia(k)} style={{ flex: 1, alignItems: "center", paddingVertical: t.espacio(1.5), borderRadius: t.radio.sm, backgroundColor: sel ? t.colores.brand : "transparent" }}>
              <Text variante="caption" tono={sel ? "inverso" : "muted"}>
                {DIAS[d.getDay()]}
              </Text>
              <Text mono weight="semibold" tono={sel ? "inverso" : "normal"} style={{ fontSize: 16 }}>
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ position: "relative", marginTop: t.espacio(2) }}>
          {horas.map((h, i) => (
            <View key={h} style={{ position: "absolute", top: i * HORA_ALTO, left: 0, right: 0, height: HORA_ALTO, borderTopWidth: 1, borderTopColor: t.colores.border }}>
              <Text mono variante="caption" tono="faint" style={{ marginLeft: t.espacio(2), marginTop: -7 }}>
                {String(h).padStart(2, "0")}:00
              </Text>
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
                  right: t.espacio(4),
                  height: alto - 3,
                  backgroundColor: t.colores.surface,
                  borderRadius: t.radio.sm,
                  borderWidth: 1,
                  borderColor: t.colores.border,
                  borderLeftWidth: 3,
                  borderLeftColor: colorEstado(c.estado, t),
                  paddingHorizontal: t.espacio(2),
                  paddingVertical: 3,
                  overflow: "hidden",
                }}
              >
                {compacto ? (
                  <Text variante="caption" numberOfLines={1}>
                    <Text mono variante="caption" weight="semibold">
                      {c.hora.slice(0, 5)}{" "}
                    </Text>
                    {c.titulo}
                    {c.cliente?.nombre ? ` · ${c.cliente.nombre}` : ""}
                  </Text>
                ) : (
                  <>
                    <Text mono variante="caption" weight="semibold">
                      {c.hora.slice(0, 5)}
                    </Text>
                    <Text variante="caption" weight="semibold" numberOfLines={1}>
                      {c.titulo}
                    </Text>
                    {c.cliente?.nombre ? (
                      <Text variante="caption" tono="muted" numberOfLines={1}>
                        {c.cliente.nombre}
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
            );
          })}

          {/* Línea de "ahora" */}
          {anclaKey === hoyKey && topAhora >= 0 && topAhora <= horas.length * HORA_ALTO ? (
            <View style={{ position: "absolute", top: topAhora, left: 0, right: 0, flexDirection: "row", alignItems: "center" }}>
              <Text mono variante="caption" weight="semibold" style={{ color: t.colores.accent, width: 52, textAlign: "right", marginRight: 2 }}>
                {String(ahora.getHours()).padStart(2, "0")}:{String(ahora.getMinutes()).padStart(2, "0")}
              </Text>
              <View style={{ flex: 1, height: 1.5, backgroundColor: t.colores.accent }} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function FilaCita({ item, esGestion, onPress }: { item: TareaConDatos; esGestion: boolean; onPress: () => void }) {
  const t = useTema();
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3), paddingVertical: t.espacio(2.5), borderBottomWidth: 1, borderBottomColor: t.colores.border }}
    >
      <Text mono weight="semibold" style={{ width: 46 }}>
        {item.hora ? item.hora.slice(0, 5) : "--:--"}
      </Text>
      <View style={{ flex: 1 }}>
        <Text weight="semibold" numberOfLines={1}>
          {item.titulo}
        </Text>
        <Text variante="caption" tono="muted" numberOfLines={1}>
          {item.cliente?.nombre ?? "Sin cliente"}
          {esGestion && item.responsable?.nombre ? ` · ${item.responsable.nombre}` : ""}
        </Text>
      </View>
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: colorEstado(item.estado, t) }} />
    </Pressable>
  );
}
