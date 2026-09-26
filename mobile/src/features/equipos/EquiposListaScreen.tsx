import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Car, ChevronRight, Wrench } from "lucide-react-native";
import type { EstadoDocumento } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { EmptyState, ErrorState, Input, ListRow, ListRowGrupo, LoadingState, ScreenHeader, StatusBadge, Texto } from "@bitacora/ui/native";
import { useAuth } from "../auth/AuthContext";
import type { MasStackParamList } from "../../shell/navigation/types";
import { alertasDocumentos, esVehiculo, listarEquipos, miVehiculo, type EquipoConAsignacion } from "../../services/equipos";
import { permisosEquipos } from "./permisos";

type Filtro = "todos" | "vehiculos" | "otros";

// Tarea 146: lista de equipos para quien tiene el módulo Flota o Equipos.
// Un chofer sin esos módulos ve solo su vehículo asignado (se abre su
// ficha directamente).
export function EquiposListaScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "Equipos">) {
  const auth = useAuth();
  const permisos = permisosEquipos(auth);
  const [equipos, setEquipos] = useState<EquipoConAsignacion[] | null>(null);
  const [alertas, setAlertas] = useState<Map<string, EstadoDocumento>>(new Map());
  const [desdeCache, setDesdeCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinVehiculo, setSinVehiculo] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const cargar = useCallback(async () => {
    setError(null);
    try {
      if (!permisos.verLista) {
        const propio = await miVehiculo();
        if (propio) navigation.replace("EquipoDetalle", { equipoId: propio.id });
        else setSinVehiculo(true);
        return;
      }
      const [r, a] = await Promise.all([listarEquipos(), permisos.flota ? alertasDocumentos() : Promise.resolve(new Map<string, EstadoDocumento>())]);
      setEquipos(r.equipos.filter((e) => e.activo));
      setDesdeCache(r.desdeCache);
      setAlertas(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    }
  }, [navigation, permisos.verLista, permisos.flota]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (sinVehiculo) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Mi vehículo" accion={volver} />
        <EmptyState
          icono={<Car size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
          titulo="No tienes un vehículo asignado"
          mensaje="Pídele a la oficina que te asigne el camión para ver sus datos y documentos."
        />
      </View>
    );
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = (equipos ?? [])
    .filter((e) => (filtro === "vehiculos" ? esVehiculo(e) : filtro === "otros" ? !esVehiculo(e) : true))
    .filter((e) => !q || [e.nombre, e.patente, e.marca, e.modelo, e.asignacion_vigente?.colaborador_nombre].some((v) => v?.toLowerCase().includes(q)));

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        titulo="Equipos"
        accion={volver}
        filtros={{
          opciones: [
            { valor: "todos", etiqueta: "Todos" },
            { valor: "vehiculos", etiqueta: "Vehículos" },
            { valor: "otros", etiqueta: "Otros equipos" },
          ],
          valor: filtro,
          onCambio: (v) => setFiltro(v as Filtro),
        }}
      />
      {error && !equipos ? (
        <ErrorState mensaje="No se pudieron cargar los equipos. Revisa tu conexión." onReintentar={() => void cargar()} />
      ) : !equipos ? (
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["3"] }}
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
          <Input valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre, patente o chofer" />
          {desdeCache ? (
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Sin conexión — mostrando lo último guardado.
            </Texto>
          ) : null}
          {visibles.length === 0 ? (
            <EmptyState titulo={equipos.length === 0 ? "Todavía no hay equipos" : "Ningún equipo coincide"} mensaje={equipos.length === 0 ? "Los equipos se crean desde la web." : undefined} />
          ) : (
            <ListRowGrupo>
              {visibles.map((e) => {
                const vehiculo = esVehiculo(e);
                const alerta = alertas.get(e.id);
                const detalle = [vehiculo ? e.patente : null, [e.marca, e.modelo].filter(Boolean).join(" ") || null, e.asignacion_vigente?.colaborador_nombre ?? null]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <ListRow
                    key={e.id}
                    icono={vehiculo ? <Car size={20} strokeWidth={2.5} color={tokens.color.accentRamp["700"]} /> : <Wrench size={20} strokeWidth={2.5} color={tokens.color.accentRamp["700"]} />}
                    titulo={e.nombre}
                    subtitulo={detalle || undefined}
                    trailing={
                      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["1"] }}>
                        {alerta ? (
                          <StatusBadge estado={alerta} etiqueta={alerta === "vencido" ? "Doc. vencido" : "Doc. por vencer"} tonoForzado={alerta === "vencido" ? "peligro" : "advertencia"} />
                        ) : null}
                        <ChevronRight size={18} strokeWidth={2.5} color={tokens.color.textSecondary} />
                      </View>
                    }
                    onPress={() => navigation.navigate("EquipoDetalle", { equipoId: e.id })}
                  />
                );
              })}
            </ListRowGrupo>
          )}
        </ScrollView>
      )}
    </View>
  );
}
