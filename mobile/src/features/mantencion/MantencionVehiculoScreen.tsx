import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, Car, CheckCheck, Wrench } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Equipo } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Card, EmptyState, ErrorState, LoadingState, ScreenHeader, StatusBadge, Texto, useMarca } from "@bitacora/ui/native";
import { PickerBuscable } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import type { MasStackParamList } from "../../shell/navigation/types";
import {
  listarVehiculos,
  obtenerHistorialEquipo,
  obtenerMantencionInicio,
  type MantencionInicio,
  type MantencionResumen,
} from "../../services/mantencion";

const fechaCorta = (iso: string) => {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return d && m ? `${d} ${meses[m - 1]}` : iso;
};

// Sistema visual móvil v2 (14-sep-2026) — migración de este hub del
// sistema viejo (useTema/Ionicons/Card de components/ui) al nuevo:
// ScreenHeader propio con volver (pantalla push), Card/EmptyState/
// ErrorState/LoadingState/StatusBadge de @bitacora/ui/native. Se
// mantiene `PickerBuscable` (mobile/components/ui) para "Cambiar de
// camión" — es la primitiva con buscador de la app, mismo criterio que
// AsignarPackModal dentro de ClienteDetalleScreen ya migrada: un modal
// propio, autocontenido, no forma parte de la cabecera/chrome que se
// está migrando.
export function MantencionVehiculoScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "MantencionVehiculo">) {
  const marca = useMarca();
  const auth = useAuth();
  const puedeCambiar = auth.fase === "listo" && auth.modulosVisibles.includes("flota");

  const [inicio, setInicio] = useState<MantencionInicio | null>(null);
  const [error, setError] = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);

  // Cuando un admin/supervisor cambia de camión, este override manda.
  const [override, setOverride] = useState<Equipo | null>(null);
  const [registrosOverride, setRegistrosOverride] = useState<MantencionResumen[]>([]);
  const [vehiculos, setVehiculos] = useState<Equipo[]>([]);

  useEffect(() => {
    if (puedeCambiar) void listarVehiculos().then(setVehiculos);
  }, [puedeCambiar]);

  const cargar = useCallback(async () => {
    try {
      const r = await obtenerMantencionInicio(4);
      setInicio(r.datos);
      setDesdeCache(r.desdeCache);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      if (override) void obtenerHistorialEquipo(override.id).then((h) => setRegistrosOverride(h.registros.slice(0, 4)));
    }, [cargar, override])
  );

  const vehiculo = override ?? inicio?.vehiculo ?? null;
  const registros = override ? registrosOverride : (inicio?.registros ?? []);

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!inicio && error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Mantención" accion={volver} />
        <ErrorState mensaje="No se pudo cargar la información del vehículo." onReintentar={() => void cargar()} />
      </View>
    );
  }
  if (!inicio) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Mantención" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  if (!vehiculo && !puedeCambiar) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Mantención" accion={volver} />
        <EmptyState
          icono={<Car size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
          titulo="No tienes un vehículo asignado"
          mensaje="Pídele a la oficina que te asigne el camión para registrar su mantención."
        />
      </View>
    );
  }

  const irAChecklist = (tipo: "diario" | "programa") => {
    if (!vehiculo) return;
    navigation.navigate("ChecklistMantencion", { equipoId: vehiculo.id, tipo, patente: vehiculo.patente ?? null });
  };

  const hoyISO = new Date().toISOString().slice(0, 10);
  const hizoDiarioHoy = registros.some((r) => r.tipo === "diario" && r.fecha === hoyISO);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Mantención" accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}>
        {/* Bloque de foco — mismo patrón que el saldo de ClienteDetalleScreen */}
        <View style={{ backgroundColor: marca.suave, borderRadius: 32, padding: tokens.space["6"], gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.micro} color={`${marca.fuerte}b3`} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
            {override ? "Camión seleccionado" : "Camión asignado"}
          </Texto>
          {vehiculo ? (
            <>
              <Texto tamano={26} peso="semibold" color={marca.fuerte} style={{ fontVariant: ["tabular-nums"] }}>
                {vehiculo.patente ?? "—"}
              </Texto>
              <Texto tamano={tokens.size.small} color={`${marca.fuerte}b3`}>
                {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || vehiculo.nombre}
                {vehiculo.tipo_vehiculo ? ` · ${vehiculo.tipo_vehiculo}` : ""}
              </Texto>
            </>
          ) : (
            <Texto tamano={tokens.size.body} color={marca.fuerte}>
              Elige un camión para registrar su mantención.
            </Texto>
          )}
        </View>

        {vehiculo ? (
          <View style={{ flexDirection: "row", gap: tokens.space["3"] }}>
            <BotonGrande
              titulo="Checklist diario"
              sub={hizoDiarioHoy ? "35 ítems · ya lo hiciste hoy" : "35 ítems · aún no lo haces hoy"}
              icono={<CheckCheck size={17} strokeWidth={2.5} color={marca.base} />}
              color={marca.base}
              fondo={`${marca.base}1f`}
              onPress={() => irAChecklist("diario")}
            />
            <BotonGrande
              titulo="Mantención Flota"
              sub="Cada 250 h o 6 meses"
              icono={<Wrench size={17} strokeWidth={2.5} color={tokens.color.accentRamp["700"]} />}
              color={tokens.color.accentRamp["700"]}
              fondo={tokens.color.accentRamp["200"]}
              onPress={() => irAChecklist("programa")}
            />
          </View>
        ) : null}

        {vehiculo ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: tokens.space["1"] }}>
              <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
                Últimas mantenciones
              </Texto>
              {registros.length > 0 ? (
                <Pressable hitSlop={8} onPress={() => navigation.navigate("MantencionHistorial", { equipoId: vehiculo.id, patente: vehiculo.patente ?? null })}>
                  <Texto tamano={tokens.size.caption} peso="semibold" color={marca.base}>
                    Ver todas
                  </Texto>
                </Pressable>
              ) : null}
            </View>
            {desdeCache ? (
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} style={{ marginBottom: tokens.space["2"] }}>
                Sin conexión — mostrando lo último guardado.
              </Texto>
            ) : null}
            {registros.length === 0 ? (
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} style={{ paddingVertical: tokens.space["2"] }}>
                Este camión todavía no tiene mantenciones registradas.
              </Texto>
            ) : (
              <View style={{ borderTopWidth: 1, borderTopColor: tokens.color.divider }}>
                {registros.map((r) => (
                  <FilaRegistro key={r.id} r={r} />
                ))}
              </View>
            )}
          </Card>
        ) : null}

        {puedeCambiar ? (
          <PickerBuscable
            etiqueta="Cambiar de camión"
            placeholder="Elegir otro camión de la flota"
            valor={override?.id ?? ""}
            opcionVacia="Volver a mi camión asignado"
            opciones={vehiculos.map((v) => ({ id: v.id, label: v.patente ?? v.nombre, sublabel: [v.marca, v.modelo].filter(Boolean).join(" ") }))}
            onElegir={(id) => {
              const v = id ? (vehiculos.find((x) => x.id === id) ?? null) : null;
              setOverride(v);
              setRegistrosOverride([]);
              if (v) void obtenerHistorialEquipo(v.id).then((h) => setRegistrosOverride(h.registros.slice(0, 4)));
            }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function FilaRegistro({ r }: { r: MantencionResumen }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["3"], paddingVertical: tokens.space["3"], borderBottomWidth: 1, borderBottomColor: tokens.color.divider }}
    >
      <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} style={{ width: 46, fontVariant: ["tabular-nums"] }}>
        {fechaCorta(r.fecha)}
      </Texto>
      <Texto tamano={tokens.size.small} color={tokens.color.text} style={{ flex: 1 }} numberOfLines={1}>
        {r.tipo === "programa" ? "Programa" : "Diario"}
        {r.realizado_por_nombre ? ` · ${r.realizado_por_nombre}` : ""}
      </Texto>
      {r.con_novedades ? (
        <StatusBadge estado="con_novedades" etiqueta="Novedades" tonoForzado="en_progreso" />
      ) : (
        <StatusBadge estado="ok" etiqueta="OK" tonoForzado="completado" />
      )}
    </View>
  );
}

function BotonGrande({
  titulo,
  sub,
  icono,
  color,
  fondo,
  onPress,
}: {
  titulo: string;
  sub: string;
  icono: ReactNode;
  color: string;
  fondo: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 118,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: tokens.color.divider,
        backgroundColor: tokens.color.surface,
        padding: tokens.space["3"],
        gap: tokens.space["2"],
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ width: 30, height: 30, borderRadius: tokens.radius.sm, backgroundColor: fondo, alignItems: "center", justifyContent: "center" }}>{icono}</View>
      <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text}>
        {titulo}
      </Texto>
      <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
        {sub}
      </Texto>
    </Pressable>
  );
}
