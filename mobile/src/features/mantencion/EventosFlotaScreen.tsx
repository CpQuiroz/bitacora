import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EventoFlotaConAutor, TipoEventoFlota } from "@bitacora/shared";
import { ETIQUETA_TIPO_EVENTO_FLOTA, TIPOS_EVENTO_FLOTA } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, ErrorState, Input, LoadingState, ScreenHeader, Textarea, Texto, useMarca, useToast } from "@bitacora/ui/native";
import { useRed } from "../../services/sync/NetworkProvider";
import { encolarEventoFlota, listarEventosSemana } from "../../services/eventosFlota";
import type { MasStackParamList } from "../../shell/navigation/types";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function iso(d: Date): string {
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

// Eventos semanales de flota (migración 128, 23-sep-2026) — desde
// Mantención → "Eventos de la semana". Lista de la semana (lunes–domingo,
// con navegación) + formulario corto: día, tipo (lista fija), descripción
// y km opcionales. Se registra por la cola offline.
export function EventosFlotaScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "EventosFlota">) {
  const { equipoId, patente } = route.params;
  const marca = useMarca();
  const toast = useToast();
  const { enLinea } = useRed();
  const hoy = useMemo(() => new Date(), []);
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const [eventos, setEventos] = useState<EventoFlotaConAutor[] | null>(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(iso(hoy));
  const [tipo, setTipo] = useState<TipoEventoFlota | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [kilometraje, setKilometraje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const domingo = sumarDias(lunes, 6);
  const esSemanaActual = iso(lunes) === iso(lunesDe(hoy));
  // Días elegibles para el evento: los de la semana en pantalla, sin futuros.
  const diasElegibles = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)).filter((d) => iso(d) <= iso(hoy));

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await listarEventosSemana(equipoId, iso(lunes), iso(sumarDias(lunes, 6)));
      setEventos(r.eventos);
      setDesdeCache(r.desdeCache);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los eventos");
    }
  }, [equipoId, lunes]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  function moverSemana(delta: number) {
    const nuevo = sumarDias(lunes, delta * 7);
    if (iso(nuevo) > iso(hoy)) return;
    setLunes(nuevo);
    setEventos(null);
    // El día elegido para el formulario se mueve a esa semana.
    const ultimo = sumarDias(nuevo, 6);
    setFecha(iso(ultimo) <= iso(hoy) ? iso(ultimo) : iso(hoy));
  }

  async function guardar() {
    if (!tipo) return toast("Falta el tipo: elige qué tipo de evento fue.", { tono: "error" });
    if (tipo === "otro" && !descripcion.trim()) return toast("Falta la descripción: describe el evento cuando el tipo es \"Otro\".", { tono: "error" });
    setGuardando(true);
    await encolarEventoFlota(equipoId, { tipo, fecha, descripcion, kilometraje });
    setGuardando(false);
    setTipo(null);
    setDescripcion("");
    setKilometraje("");
    if (enLinea) toast("Evento registrado", { tono: "exito" });
    else toast("Evento registrado. Se enviará apenas vuelvas a tener señal.", { tono: "info" });
    // Pequeña espera para que la cola alcance a enviarlo antes de recargar.
    setTimeout(() => void cargar(), 800);
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  const chip = (activo: boolean) => ({
    minHeight: 34,
    paddingHorizontal: tokens.space["3"],
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: activo ? marca.base : tokens.color.divider,
    backgroundColor: activo ? `${marca.base}1f` : tokens.color.surface,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  });

  // Agrupados por día (ya vienen ordenados por fecha desc).
  const porDia = new Map<string, EventoFlotaConAutor[]>();
  for (const e of eventos ?? []) {
    if (!porDia.has(e.fecha)) porDia.set(e.fecha, []);
    porDia.get(e.fecha)!.push(e);
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo={patente ?? undefined} titulo="Eventos de la semana" accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: tokens.space["3"] }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Semana anterior" onPress={() => moverSemana(-1)} hitSlop={10}>
            <ChevronLeft size={22} color={tokens.color.text} />
          </Pressable>
          <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
            {esSemanaActual ? "Esta semana" : `${lunes.getDate()} ${MESES[lunes.getMonth()]} – ${domingo.getDate()} ${MESES[domingo.getMonth()]}`}
          </Texto>
          <Pressable accessibilityRole="button" accessibilityLabel="Semana siguiente" onPress={() => moverSemana(1)} hitSlop={10} disabled={esSemanaActual} style={{ opacity: esSemanaActual ? 0.3 : 1 }}>
            <ChevronRight size={22} color={tokens.color.text} />
          </Pressable>
        </View>

        <Card>
          <View style={{ gap: tokens.space["3"] }}>
            <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
              Registrar un evento
            </Texto>

            <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.textSecondary}>
              Día
            </Texto>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space["2"] }}>
              {diasElegibles.map((d) => {
                const k = iso(d);
                const activo = fecha === k;
                return (
                  <Pressable key={k} onPress={() => setFecha(k)} style={chip(activo)}>
                    <Texto tamano={tokens.size.caption} peso={activo ? "semibold" : "medium"} color={activo ? marca.base : tokens.color.textSecondary}>
                      {k === iso(hoy) ? "Hoy" : `${DIAS[d.getDay()]} ${d.getDate()}`}
                    </Texto>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.textSecondary}>
              Tipo de evento
            </Texto>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
              {TIPOS_EVENTO_FLOTA.map((t) => {
                const activo = tipo === t;
                return (
                  <Pressable key={t} onPress={() => setTipo(t)} style={chip(activo)}>
                    <Texto tamano={tokens.size.caption} peso={activo ? "semibold" : "medium"} color={activo ? marca.base : tokens.color.textSecondary}>
                      {ETIQUETA_TIPO_EVENTO_FLOTA[t]}
                    </Texto>
                  </Pressable>
                );
              })}
            </View>

            <Textarea
              etiqueta={tipo === "otro" ? "Descripción" : "Descripción (opcional)"}
              placeholder="Ej.: se cambió la ampolleta del foco trasero"
              filas={2}
              valor={descripcion}
              onCambio={setDescripcion}
            />
            <Input etiqueta="Kilometraje (opcional)" tipo="numero" valor={kilometraje} onCambio={setKilometraje} />
            <Button bloque onPress={() => void guardar()} cargando={guardando}>
              Guardar evento
            </Button>
          </View>
        </Card>

        {desdeCache ? (
          <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
            Sin conexión — mostrando lo último guardado.
          </Texto>
        ) : null}

        {error && !eventos ? (
          <ErrorState mensaje={error} onReintentar={() => void cargar()} />
        ) : eventos === null ? (
          <LoadingState />
        ) : eventos.length === 0 ? (
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            Sin eventos registrados esta semana.
          </Texto>
        ) : (
          [...porDia.entries()].map(([dia, lista]) => {
            const d = new Date(dia + "T00:00:00");
            return (
              <View key={dia} style={{ gap: tokens.space["2"] }}>
                <Texto tamano={tokens.size.caption} peso="semibold" color={tokens.color.textSecondary} style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
                  {dia === iso(hoy) ? "Hoy" : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`}
                </Texto>
                {lista.map((e) => (
                  <View key={e.id} style={{ borderBottomWidth: 1, borderBottomColor: tokens.color.divider, paddingBottom: tokens.space["2"], gap: 2 }}>
                    <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
                      {ETIQUETA_TIPO_EVENTO_FLOTA[e.tipo] ?? e.tipo}
                    </Texto>
                    {e.descripcion ? (
                      <Texto tamano={tokens.size.small} color={tokens.color.text}>
                        {e.descripcion}
                      </Texto>
                    ) : null}
                    <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                      {e.autor?.nombre ?? "—"}
                      {e.kilometraje != null ? ` · ${Number(e.kilometraje).toLocaleString("es-CL")} km` : ""}
                    </Texto>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
