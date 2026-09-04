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

type Modo = "mes" | "semana" | "dia";
// Se recuerda mientras la app siga abierta.
let ultimoModo: Modo = "mes";

export function AgendaScreen({ navigation }: NativeStackScreenProps<AgendaStackParamList, "AgendaLista">) {
  const t = useTema();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const hoy = new Date();
  const hoyKey = clave(hoy);

  const [modo, setModo] = useState<Modo>(ultimoModo);
  const [ancla, setAncla] = useState(hoyKey); // día de referencia según el modo
  const [tareas, setTareas] = useState<TareaConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  useEffect(() => {
    ultimoModo = modo;
  }, [modo]);

  const anclaDate = useMemo(() => new Date(ancla + "T00:00:00"), [ancla]);

  // Rango de días visible según el modo.
  const { desde, hasta, diasDelRango } = useMemo(() => {
    if (modo === "dia") {
      return { desde: ancla, hasta: ancla, diasDelRango: [anclaDate] };
    }
    if (modo === "semana") {
      const l = lunesDe(anclaDate);
      const dias = Array.from({ length: 7 }, (_, i) => sumarDias(l, i));
      return { desde: clave(dias[0]), hasta: clave(dias[6]), diasDelRango: dias };
    }
    // mes: mes completo del ancla
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

  const totalRango = useMemo(
    () => diasDelRango.reduce((s, d) => s + (porDia.get(clave(d))?.length ?? 0), 0),
    [diasDelRango, porDia]
  );

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

  const irAncla = () => setAncla(hoyKey);
  const abrirCita = (item: TareaConDatos) => navigation.navigate("TareaDetalle", { tareaId: item.id, titulo: item.titulo });
  const nuevaCita = (fecha?: string) => navigation.navigate("NuevaCita", { fecha: fecha && fecha >= hoyKey ? fecha : undefined });
  const verDia = (k: string) => {
    setAncla(k);
    setModo("dia");
  };

  if (tareas === null && !error) return <LoadingScreen />;
  if (error && !tareas) return <ErrorState mensaje={error} onReintentar={cargar} />;

  // Días del rango que tienen citas (para el listado).
  const diasConCitas = diasDelRango.map((d) => clave(d)).filter((k) => (porDia.get(k)?.length ?? 0) > 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />

      {/* Selector de modo */}
      <View style={{ flexDirection: "row", gap: t.espacio(2), padding: t.espacio(4), paddingBottom: t.espacio(3) }}>
        {([
          { k: "mes", label: "Mes" },
          { k: "semana", label: "Semana" },
          { k: "dia", label: "Día" },
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

      {/* Navegación de período */}
      <View style={{ paddingHorizontal: t.espacio(4), paddingBottom: t.espacio(3) }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => mover(-1)} hitSlop={10} style={{ padding: t.espacio(1) }}>
            <Ionicons name="chevron-back" size={22} color={t.colores.foreground} />
          </Pressable>
          <Pressable onPress={irAncla} hitSlop={10} style={{ alignItems: "center" }}>
            <Text variante="etiqueta" weight="semibold" style={{ textTransform: "capitalize" }}>
              {titulo}
            </Text>
            <Text variante="caption" tono="muted">
              {totalRango} {totalRango === 1 ? "cita" : "citas"}
            </Text>
          </Pressable>
          <Pressable onPress={() => mover(1)} hitSlop={10} style={{ padding: t.espacio(1) }}>
            <Ionicons name="chevron-forward" size={22} color={t.colores.foreground} />
          </Pressable>
        </View>
      </View>

      {/* Grilla del mes / tira de la semana */}
      {modo === "mes" ? (
        <GrillaMes ancla={anclaDate} hoyKey={hoyKey} porDia={porDia} onDia={verDia} />
      ) : modo === "semana" ? (
        <TiraSemana dias={diasDelRango} hoyKey={hoyKey} porDia={porDia} onDia={verDia} />
      ) : null}

      {/* Listado de citas del período */}
      <ScrollView
        contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(4), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
      >
        {diasConCitas.length === 0 ? (
          <EmptyState
            icono={<Ionicons name="calendar-outline" size={40} color={t.colores.faint} />}
            titulo={modo === "dia" ? "Sin citas este día" : modo === "semana" ? "Sin citas esta semana" : "Sin citas este mes"}
            mensaje="Toca «Nueva cita» para agendar una."
          />
        ) : (
          diasConCitas.map((k) => {
            const d = new Date(k + "T00:00:00");
            const feriado = esFeriado(k);
            const etiqueta =
              k === hoyKey
                ? "Hoy"
                : modo === "dia"
                ? `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
                : `${DIAS_LARGO[d.getDay()].slice(0, 3)} ${d.getDate()}`;
            return (
              <View key={k} style={{ gap: t.espacio(2) }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
                  <Text variante="etiqueta" weight="semibold" style={{ textTransform: "capitalize" }}>
                    {etiqueta}
                  </Text>
                  {feriado ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colores.success }} /> : null}
                </View>
                {feriado ? (
                  <Text variante="caption" tono="success">
                    Feriado · {feriado}
                  </Text>
                ) : null}
                {porDia.get(k)!.map((item) => (
                  <CitaCard key={item.id} item={item} esGestion={esGestion} onPress={() => abrirCita(item)} />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={{ padding: t.espacio(4), paddingTop: t.espacio(2) }}>
        <Button titulo="Nueva cita" onPress={() => nuevaCita(modo === "dia" ? ancla : undefined)} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function GrillaMes({
  ancla,
  hoyKey,
  porDia,
  onDia,
}: {
  ancla: Date;
  hoyKey: string;
  porDia: Map<string, TareaConDatos[]>;
  onDia: (k: string) => void;
}) {
  const t = useTema();
  const inicioGrilla = useMemo(() => lunesDe(new Date(ancla.getFullYear(), ancla.getMonth(), 1)), [ancla]);
  const celdas = useMemo(() => Array.from({ length: 42 }, (_, i) => sumarDias(inicioGrilla, i)), [inicioGrilla]);
  const mesNum = ancla.getMonth();

  return (
    <View style={{ paddingHorizontal: t.espacio(4), paddingBottom: t.espacio(3), borderBottomWidth: 1, borderBottomColor: t.colores.border }}>
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
          const esHoy = k === hoyKey;
          const n = porDia.get(k)?.length ?? 0;
          const feriado = Boolean(esFeriado(k));
          return (
            <Pressable
              key={k}
              onPress={() => onDia(k)}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: esHoy ? t.colores.brand : "transparent",
                }}
              >
                <Text variante="etiqueta" weight={esHoy ? "semibold" : "regular"} tono={esHoy ? "inverso" : delMes ? "normal" : "faint"}>
                  {d.getDate()}
                </Text>
              </View>
              <Puntos citas={n} feriado={feriado} sel={esHoy} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TiraSemana({
  dias,
  hoyKey,
  porDia,
  onDia,
}: {
  dias: Date[];
  hoyKey: string;
  porDia: Map<string, TareaConDatos[]>;
  onDia: (k: string) => void;
}) {
  const t = useTema();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: t.espacio(1.5),
        paddingHorizontal: t.espacio(4),
        paddingBottom: t.espacio(3),
        borderBottomWidth: 1,
        borderBottomColor: t.colores.border,
      }}
    >
      {dias.map((d) => {
        const k = clave(d);
        const esHoy = k === hoyKey;
        const n = porDia.get(k)?.length ?? 0;
        const feriado = Boolean(esFeriado(k));
        return (
          <Pressable
            key={k}
            onPress={() => onDia(k)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: t.espacio(1.5),
              borderRadius: t.radio.md,
              borderWidth: esHoy ? 1 : 0,
              borderColor: t.colores.brand,
            }}
          >
            <Text variante="caption" tono="muted">
              {DIAS[d.getDay()]}
            </Text>
            <Text variante="subtitulo">{d.getDate()}</Text>
            <Puntos citas={n} feriado={feriado} sel={false} />
          </Pressable>
        );
      })}
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
