import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import { CalendarClock, Car, CalendarRange, ClipboardList, Search, Sun } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUNCIONES_LEVANTAMIENTOS } from "@bitacora/shared";
import { AsistenteButton, Card, EmptyState, ErrorState, ESPACIO_ASISTENTE_FLOTANTE, LoadingState, ScreenHeader, Skeleton, StatusBadge, Texto, useMarca } from "@bitacora/ui/native";
import { OfflineBanner } from "../../components/OfflineBanner";
import { claveFecha, formatearFechaLarga, lunesDe, sumarDias } from "../../lib/horario";
import { useAuth } from "../auth/AuthContext";
import { cargarHoy, type ItemHoy } from "../../services/hoy";
import type { HoyStackParamList } from "../../shell/navigation/types";

const ICONO: Record<ItemHoy["tipo"], typeof ClipboardList> = {
  trabajo: ClipboardList,
  cita: CalendarClock,
  viaje: Car,
  levantamiento: Search,
};

// Color del ícono + del tag de folio, por tipo (18-sep-2026) — antes
// los 4 tipos se veían con el mismo ícono gris, difícil de distinguir
// de un vistazo (pedido real). Con solo 2 acentos de marca en el
// sistema (terracota/oliva) más neutral, "Cita" combina fondo de un
// acento con texto del otro — no hay un 4° tono propio todavía.
const COLOR_TIPO: Record<ItemHoy["tipo"], { fondo: string; texto: string }> = {
  trabajo: { fondo: tokens.color.accentRamp["200"], texto: tokens.color.accentRamp["700"] },
  levantamiento: { fondo: tokens.color.accent2Ramp["200"], texto: tokens.color.accent2Ramp["800"] },
  viaje: { fondo: tokens.color.neutral["200"], texto: tokens.color.neutral["800"] },
  cita: { fondo: tokens.color.accent2Ramp["200"], texto: tokens.color.accentRamp["700"] },
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  enviada: "Enviada",
  en_proceso: "En proceso",
  completada: "Completada",
  firmada: "Firmada",
  cancelada: "Cancelado",
  cancelada_anticipada: "Cancelado",
  confirmada: "Confirmada",
  no_asistio: "No asistió",
  borrador: "Borrador",
  confirmado: "Confirmado",
  facturado: "Facturado",
  // Levantamientos (18-sep-2026) — los 3 estados que aparecen en la
  // Pizarra (los demás ya se filtran antes en services/hoy.ts).
  creado: "Creado",
  asignado: "Por completar",
  en_terreno: "En terreno",
};

const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type ModoPizarra = "dia" | "semana";
// Recuerda el último modo elegido mientras la app sigue abierta — mismo
// patrón que `ultimoModo` en AgendaScreen.tsx (Mes/Sem/Día).
let ultimoModoPizarra: ModoPizarra = "dia";

// "Hoy" siempre muestra la fecha del día como antetítulo del
// ScreenHeader — misma fecha local que usa cargarHoy()/hoyISO(), no
// UTC (toISOString se corre en día equivocado cerca de medianoche).
function fechaDeHoy(): string {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return formatearFechaLarga(iso);
}

// "15–21 sep" (o "29 ago – 4 sep" si la semana cruza de mes).
function rangoSemanaTexto(lunes: Date, domingo: Date): string {
  if (lunes.getMonth() === domingo.getMonth()) return `${lunes.getDate()}–${domingo.getDate()} ${MESES[lunes.getMonth()].slice(0, 3)}`;
  return `${lunes.getDate()} ${MESES[lunes.getMonth()].slice(0, 3)} – ${domingo.getDate()} ${MESES[domingo.getMonth()].slice(0, 3)}`;
}

// Sistema visual móvil v2 (13-sep-2026, tarea #21, piloto 2) — antes
// PASO 6 del sistema de diseño ya la había migrado a @bitacora/ui/native
// + Lucide, pero con header nativo + fila de chips a mano. Ahora usa
// ScreenHeader (con antetítulo=fecha y los chips Míos/Equipo como
// `filtros`) y el Asistente se mueve del ícono del header al
// AsistenteButton flotante, gateado igual que en "Más" (antes el ícono
// del header no tenía ningún gating por plan — se corrige de paso).
//
// "Pizarra Digital" (18-sep-2026): solo cambia el título visible del
// ScreenHeader y la etiqueta de la tab bar (AppTabs.tsx) — el nombre
// interno (route key "Hoy", este componente, services/hoy.ts) no se
// tocó, no hacía falta.
//
// Vista Día/Semana (21-sep-2026, pedido: "en Pizarra quiero ver las
// actividades del día y de la semana"). Día es exactamente el
// comportamiento de siempre (lista plana de hoy). Semana agrupa por
// día (mismo criterio visual que la vista Semana de Agenda) y agrega
// dos grupos más: "Atrasado" (levantamientos con fecha_visita anterior
// al lunes — no desaparecen solos, ver services/hoy.ts) y "Sin fecha"
// (levantamientos sin fecha_visita asignada, siempre visibles). El
// filtro Míos/Equipo ya ocupaba la fila de chips del ScreenHeader, así
// que Día/Semana usa la segunda fila nueva (`filtrosSecundarios`,
// agregada a ScreenHeader para este pedido).
export function HoyScreen({ navigation }: NativeStackScreenProps<HoyStackParamList, "HoyInicio">) {
  const auth = useAuth();
  const marca = useMarca();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const incluirViajes = auth.fase === "listo" && !auth.modulosDeshabilitados.includes("viajes");
  // Asistente IA: exclusivo de Admin (Fase 2.2, 23-sep-2026) — mismo
  // criterio que MasScreen/AgendaScreen/ClientesListaScreen; el backend
  // (requiereRol("admin")) es la protección real.
  const veAsistente = auth.fase === "listo" && auth.usuario.rol === "admin" && auth.modulosVisibles.includes("asistente");
  // Mismo eje que en MasScreen.tsx: usuarios.funcion, no rol/módulo.
  const funcion = auth.fase === "listo" ? auth.usuario.funcion : null;
  const incluirLevantamientos = funcion != null && FUNCIONES_LEVANTAMIENTOS.includes(funcion);

  const [equipo, setEquipo] = useState(false);
  const [modo, setModo] = useState<ModoPizarra>(ultimoModoPizarra);
  const [items, setItems] = useState<ItemHoy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  useEffect(() => {
    ultimoModoPizarra = modo;
  }, [modo]);

  const hoyKey = claveFecha(new Date());
  const { desde, hasta, lunes, domingo } = useMemo(() => {
    if (modo === "dia") return { desde: hoyKey, hasta: hoyKey, lunes: undefined, domingo: undefined };
    const l = lunesDe(new Date());
    const d = sumarDias(l, 6);
    return { desde: claveFecha(l), hasta: claveFecha(d), lunes: l, domingo: d };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, hoyKey]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await cargarHoy(esGestion && equipo, incluirViajes, incluirLevantamientos, desde, hasta);
      setItems(r.items);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la información");
    }
  }, [esGestion, equipo, incluirViajes, incluirLevantamientos, desde, hasta]);

  useEffect(() => {
    setItems(null);
  }, [modo]);
  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  async function onRefresh() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  function abrir(item: ItemHoy) {
    if (item.tipo === "trabajo") {
      navigation.navigate("Trabajos", { screen: "TrabajoDetalle", params: { trabajoId: item.id, titulo: item.titulo } });
    } else if (item.tipo === "cita") {
      navigation.navigate("Agenda", { screen: "TareaDetalle", params: { tareaId: item.id, titulo: item.titulo } });
    } else if (item.tipo === "viaje") {
      navigation.navigate("Viajes", { screen: "ViajeDetalle", params: { viajeId: item.id } });
    } else {
      navigation.navigate("LevantamientoDetalle", { id: item.id });
    }
  }

  // Agrupación por día — solo se usa en modo "semana" (en "dia" se
  // renderiza `items` directo, sin tocar este cálculo).
  const { porDia, atrasados, sinFecha } = useMemo(() => {
    const porDia = new Map<string, ItemHoy[]>();
    const atrasados: ItemHoy[] = [];
    const sinFecha: ItemHoy[] = [];
    for (const it of items ?? []) {
      if (it.fecha == null) {
        sinFecha.push(it);
        continue;
      }
      if (it.fecha < desde) {
        atrasados.push(it);
        continue;
      }
      if (!porDia.has(it.fecha)) porDia.set(it.fecha, []);
      porDia.get(it.fecha)!.push(it);
    }
    return { porDia, atrasados, sinFecha };
  }, [items, desde]);

  const diasSemana = useMemo(() => (lunes ? Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)) : []), [lunes]);

  const filtros = esGestion
    ? {
        opciones: [
          { valor: "mios", etiqueta: "Míos" },
          { valor: "equipo", etiqueta: "Equipo" },
        ],
        valor: equipo ? "equipo" : "mios",
        onCambio: (v: string) => setEquipo(v === "equipo"),
      }
    : undefined;

  const filtrosSecundarios = {
    opciones: [
      { valor: "dia", etiqueta: "Día" },
      { valor: "semana", etiqueta: "Semana" },
    ],
    valor: modo,
    onCambio: (v: string) => setModo(v as ModoPizarra),
  };

  const antetitulo = modo === "dia" ? fechaDeHoy() : lunes && domingo ? rangoSemanaTexto(lunes, domingo) : "";

  // Esqueletos con la forma real de las tarjetas de la lista — nunca un
  // spinner de pantalla completa. El ScreenHeader se muestra igual
  // (misma fecha, mismos chips) para que la pantalla no "salte" al
  // terminar de cargar.
  if (items === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo={antetitulo} titulo="Pizarra Digital" filtros={filtros} filtrosSecundarios={filtrosSecundarios} />
        <View style={{ padding: tokens.space["4"], gap: tokens.space["3"] }}>
          <LoadingState>
            <Skeleton alto={72} radio={32} />
            <Skeleton alto={72} radio={32} />
            <Skeleton alto={72} radio={32} />
          </LoadingState>
        </View>
        <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />
      </View>
    );
  }
  if (error && !items) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo={antetitulo} titulo="Pizarra Digital" filtros={filtros} filtrosSecundarios={filtrosSecundarios} />
        <ErrorState mensaje={error} onReintentar={cargar} />
        <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo={antetitulo} titulo="Pizarra Digital" filtros={filtros} filtrosSecundarios={filtrosSecundarios} />
      <OfflineBanner guardadoEn={guardadoEn} />
      {modo === "dia" ? (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => `${item.tipo}:${item.id}`}
          contentContainerStyle={{
            padding: tokens.space["4"],
            paddingTop: tokens.space["2"],
            paddingBottom: ESPACIO_ASISTENTE_FLOTANTE,
            gap: tokens.space["3"],
            flexGrow: 1,
          }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={marca.base} />}
          ListEmptyComponent={
            <EmptyState
              icono={<Sun size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
              titulo="Nada para hoy"
              mensaje={equipo ? "El equipo no tiene nada agendado hoy." : "No tienes órdenes de servicio, citas ni viajes hoy."}
            />
          }
          renderItem={({ item }) => <FilaItem item={item} onPress={() => abrir(item)} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: tokens.space["4"], paddingTop: tokens.space["2"], paddingBottom: ESPACIO_ASISTENTE_FLOTANTE, gap: tokens.space["4"] }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={marca.base} />}
        >
          {(items?.length ?? 0) === 0 ? (
            <EmptyState
              icono={<CalendarRange size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
              titulo="Nada esta semana"
              mensaje={equipo ? "El equipo no tiene nada agendado esta semana." : "No tienes nada agendado esta semana."}
            />
          ) : (
            <>
              {atrasados.length > 0 ? (
                <View style={{ gap: tokens.space["2"] }}>
                  <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.accent}>
                    Atrasado
                  </Texto>
                  {atrasados.map((it) => (
                    <FilaItem key={`${it.tipo}:${it.id}`} item={it} onPress={() => abrir(it)} />
                  ))}
                </View>
              ) : null}

              {diasSemana.map((d) => {
                const k = claveFecha(d);
                const delDia = porDia.get(k) ?? [];
                if (delDia.length === 0) return null;
                return (
                  <View key={k} style={{ gap: tokens.space["2"] }}>
                    <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text} style={{ textTransform: "capitalize" }}>
                      {k === hoyKey ? "Hoy" : `${DIAS_LARGO[d.getDay()]} ${d.getDate()}`}
                    </Texto>
                    {delDia.map((it) => (
                      <FilaItem key={`${it.tipo}:${it.id}`} item={it} onPress={() => abrir(it)} />
                    ))}
                  </View>
                );
              })}

              {sinFecha.length > 0 ? (
                <View style={{ gap: tokens.space["2"] }}>
                  <Texto tamano={tokens.size.h5} peso="semibold" color={`${tokens.color.text}99`}>
                    Sin fecha
                  </Texto>
                  {sinFecha.map((it) => (
                    <FilaItem key={`${it.tipo}:${it.id}`} item={it} onPress={() => abrir(it)} />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
      <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />
    </View>
  );
}

function FilaItem({ item, onPress }: { item: ItemHoy; onPress: () => void }) {
  const Icono = ICONO[item.tipo];
  const color = COLOR_TIPO[item.tipo];
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.space["3"] }}>
        <View style={{ width: 44, alignItems: "center", gap: 2 }}>
          <Texto tamano={tokens.size.caption} color={tokens.color.text} peso="semibold">
            {item.hora ?? "—"}
          </Texto>
          <Icono size={16} strokeWidth={2.75} color={color.texto} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
            {item.titulo}
          </Texto>
          {item.folio ? (
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: color.fondo,
                borderRadius: 5,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}
            >
              <Texto tamano={tokens.size.micro} color={color.texto} peso="semibold">
                {item.folio}
              </Texto>
            </View>
          ) : null}
          {item.subtitulo ? (
            <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} numberOfLines={1}>
              {item.subtitulo}
            </Texto>
          ) : null}
        </View>
        {item.estado ? <StatusBadge estado={String(item.estado)} etiqueta={ETIQUETA_ESTADO[String(item.estado)] ?? String(item.estado)} /> : null}
      </View>
    </Card>
  );
}
