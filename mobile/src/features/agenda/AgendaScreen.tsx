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
import type { AgendaStackParamList } from "../../shell/navigation/types";

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
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

export function AgendaScreen({ navigation }: NativeStackScreenProps<AgendaStackParamList, "AgendaLista">) {
  const t = useTema();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const hoyKey = clave(new Date());
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const [diaSel, setDiaSel] = useState(hoyKey);
  const [tareas, setTareas] = useState<TareaConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);
  const desde = clave(diasSemana[0]);
  const hasta = clave(diasSemana[6]);

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

  const citasDelDia = porDia.get(diaSel) ?? [];
  const dSel = new Date(diaSel + "T00:00:00");
  const tituloDia =
    diaSel === hoyKey
      ? "Hoy"
      : `${DIAS_LARGO[dSel.getDay()]} ${dSel.getDate()} de ${MESES[dSel.getMonth()]}`;

  function moverSemana(delta: number) {
    setLunes((l) => sumarDias(l, delta * 7));
  }
  function irHoy() {
    setLunes(lunesDe(new Date()));
    setDiaSel(hoyKey);
  }

  if (tareas === null && !error) return <LoadingScreen />;
  if (error && !tareas) return <ErrorState mensaje={error} onReintentar={cargar} />;

  const mesRango =
    diasSemana[0].getMonth() === diasSemana[6].getMonth()
      ? `${MESES[diasSemana[0].getMonth()]} ${diasSemana[0].getFullYear()}`
      : `${MESES[diasSemana[0].getMonth()]} – ${MESES[diasSemana[6].getMonth()]}`;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />

      <View style={{ padding: t.espacio(4), gap: t.espacio(3), borderBottomWidth: 1, borderBottomColor: t.colores.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => moverSemana(-1)} hitSlop={10} style={{ padding: t.espacio(1) }}>
            <Ionicons name="chevron-back" size={22} color={t.colores.foreground} />
          </Pressable>
          <Pressable onPress={irHoy} hitSlop={10}>
            <Text variante="etiqueta" weight="semibold" style={{ textTransform: "capitalize" }}>
              {mesRango}
            </Text>
          </Pressable>
          <Pressable onPress={() => moverSemana(1)} hitSlop={10} style={{ padding: t.espacio(1) }}>
            <Ionicons name="chevron-forward" size={22} color={t.colores.foreground} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: t.espacio(1.5) }}>
          {diasSemana.map((d) => {
            const k = clave(d);
            const sel = k === diaSel;
            const hoy = k === hoyKey;
            const n = (porDia.get(k) ?? []).length;
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
                  borderWidth: hoy && !sel ? 1 : 0,
                  borderColor: t.colores.brand,
                }}
              >
                <Text variante="caption" tono={sel ? "inverso" : "muted"}>
                  {DIAS[d.getDay()]}
                </Text>
                <Text variante="subtitulo" tono={sel ? "inverso" : "normal"}>
                  {d.getDate()}
                </Text>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    marginTop: 2,
                    backgroundColor: n > 0 ? (sel ? t.colores.brandForeground : t.colores.brand) : "transparent",
                  }}
                />
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

        {citasDelDia.length === 0 ? (
          <EmptyState
            icono={<Ionicons name="calendar-outline" size={40} color={t.colores.faint} />}
            titulo="Sin citas este día"
            mensaje="Toca «Nueva cita» para agendar una."
          />
        ) : (
          citasDelDia.map((item) => (
            <Card
              key={item.id}
              onPress={() => navigation.navigate("TareaDetalle", { tareaId: item.id, titulo: item.titulo })}
            >
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
          ))
        )}
      </ScrollView>

      <View style={{ padding: t.espacio(4), paddingTop: t.espacio(2) }}>
        <Button
          titulo="Nueva cita"
          onPress={() => navigation.navigate("NuevaCita", { fecha: diaSel >= hoyKey ? diaSel : undefined })}
        />
      </View>
    </View>
  );
}
