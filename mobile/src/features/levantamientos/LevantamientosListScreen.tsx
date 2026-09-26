import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { ArrowLeft, Search } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoLevantamiento } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { EmptyState, ListRow, ListRowGrupo, LoadingState, ScreenHeader, StatusBadge, Texto, type TonoEstado } from "@bitacora/ui/native";
import { listarMisLevantamientos, type LevantamientoResumen } from "../../services/levantamientos";
import { useAuth } from "../auth/AuthContext";
import type { MasStackParamList } from "../../shell/navigation/types";

const ETIQUETA_ESTADO: Record<EstadoLevantamiento, string> = {
  creado: "Creado",
  asignado: "Por completar",
  en_terreno: "En terreno",
  completado_tecnico: "Completado — esperando cotización",
  cotizado_externo: "Cotizado — esperando aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

// Los 3 estados que necesitan que el técnico haga algo van a
// "en_progreso" (mismo acento que antes usaba t.colores.accent); los 2
// que esperan a la oficina/al cliente externo van a "cerrado" (mismo
// gris muted que antes); aprobado/rechazado ya caen bien en el mapa
// global (completado/cancelado) pero se fuerzan igual acá para no
// depender del fallback implícito.
function tonoDe(estado: EstadoLevantamiento): TonoEstado {
  if (estado === "creado" || estado === "asignado" || estado === "en_terreno") return "en_progreso";
  if (estado === "completado_tecnico" || estado === "cotizado_externo") return "cerrado";
  if (estado === "aprobado") return "completado";
  return "cancelado"; // rechazado
}

// El técnico solo ve los suyos (el backend ya los filtra) — nada que
// completar además de descripción + materiales + fotos. Cotizar y
// aprobar/rechazar es exclusivo de la web (Admin). El Admin SÍ ve
// todos los de la empresa acá (21-sep-2026, pedido explícito) — el
// backend ya no filtra por técnico para ese rol; en esta pantalla se
// agrega el nombre del técnico en el subtítulo para que se pueda
// distinguir de quién es cada uno.
//
// Sistema visual móvil v2 (14-sep-2026) — ScreenHeader propio con
// `accion`=volver (pantalla push desde "Más", no raíz de tab) +
// ListRow/ListRowGrupo en vez de las tarjetas con borde a mano.
export function LevantamientosListScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "Levantamientos">) {
  const auth = useAuth();
  const esAdmin = auth.fase === "listo" && auth.usuario.rol === "admin";
  const [lista, setLista] = useState<LevantamientoResumen[] | null>(null);

  const cargar = useCallback(async () => {
    setLista(await listarMisLevantamientos());
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (lista === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Levantamientos" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Levantamientos" accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], flexGrow: 1 }}>
        {lista.length === 0 ? (
          <EmptyState
            icono={<Search size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
            titulo="Sin levantamientos"
            mensaje={esAdmin ? "Todavía no hay ninguno creado." : "No tenés ninguno asignado por ahora."}
          />
        ) : (
          <ListRowGrupo>
            {lista.map((item) => (
              <ListRow
                key={item.id}
                icono={<Search size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                titulo={item.cliente?.nombre ?? "Cliente"}
                subtitulo={
                  [
                    formatearFolio("LEV", item.folio),
                    esAdmin ? (item.tecnico?.nombre ?? "Sin técnico asignado") : null,
                    item.descripcion_requerimiento,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                onPress={() => navigation.navigate("LevantamientoDetalle", { id: item.id })}
                trailing={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <StatusBadge estado={item.estado} etiqueta={ETIQUETA_ESTADO[item.estado]} tonoForzado={tonoDe(item.estado)} />
                    <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ fontVariant: ["tabular-nums"] }}>
                      {new Date(item.creado_en).toLocaleDateString("es-CL")}
                    </Texto>
                  </View>
                }
              />
            ))}
          </ListRowGrupo>
        )}
      </ScrollView>
    </View>
  );
}
