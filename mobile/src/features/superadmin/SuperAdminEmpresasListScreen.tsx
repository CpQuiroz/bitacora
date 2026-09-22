import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Building2, LogOut } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { EmptyState, Input, ListRow, ListRowGrupo, LoadingState, ScreenHeader, StatusBadge, Texto, type TonoEstado } from "@bitacora/ui/native";
import { listarEmpresasSuperAdmin, type EmpresaSuperAdmin } from "../../services/superadmin";
import { useSuperAdminAuth } from "./SuperAdminAuthContext";
import type { SuperAdminStackParamList } from "./types";

const ETIQUETA_ESTADO: Record<string, string> = { activa: "Activa", suspendida: "Suspendida", dada_de_baja: "Dada de baja" };
const TONO_ESTADO: Record<string, TonoEstado> = { activa: "completado", suspendida: "en_progreso", dada_de_baja: "cancelado" };
const ETIQUETA_PLAN: Record<string, string> = { trial: "Trial", basico: "Básico", pro: "Pro" };

// Fase 1 del panel de Super-Admin en mobile — lista de todas las
// empresas (mismo endpoint que el panel web, GET /api/superadmin/empresas).
// A propósito no cachea nada localmente (ver SuperAdminAuthContext).
export function SuperAdminEmpresasListScreen({ navigation }: NativeStackScreenProps<SuperAdminStackParamList, "EmpresasLista">) {
  const auth = useSuperAdminAuth();
  const [empresas, setEmpresas] = useState<EmpresaSuperAdmin[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async (q?: string) => {
    const r = await listarEmpresasSuperAdmin(q);
    setEmpresas(r);
  }, []);

  useFocusEffect(useCallback(() => void cargar(busqueda), [cargar, busqueda]));

  async function onRefrescar() {
    setRefrescando(true);
    await cargar(busqueda);
    setRefrescando(false);
  }

  function onCambiarBusqueda(v: string) {
    setBusqueda(v);
    void cargar(v);
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        titulo="Empresas"
        accion={{ icono: <LogOut size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: auth.cerrarSesion, etiquetaAccesible: "Cerrar sesión" }}
      />
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"] }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefrescar} />}
      >
        <Input placeholder="Buscar empresa…" valor={busqueda} onCambio={onCambiarBusqueda} />

        {empresas === null ? (
          <LoadingState />
        ) : empresas.length === 0 ? (
          <EmptyState icono={<Building2 size={28} strokeWidth={2.75} />} titulo="Sin resultados" mensaje="Ninguna empresa coincide con la búsqueda." />
        ) : (
          <ListRowGrupo>
            {empresas.map((e) => (
              <ListRow
                key={e.id}
                icono={<Building2 size={20} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                titulo={e.nombre}
                subtitulo={`${ETIQUETA_PLAN[e.plan] ?? e.plan} · ${e.cantidad_usuarios} usuario${e.cantidad_usuarios === 1 ? "" : "s"}`}
                onPress={() => navigation.navigate("EmpresaDetalle", { id: e.id })}
                trailing={<StatusBadge estado={e.estado} etiqueta={ETIQUETA_ESTADO[e.estado] ?? e.estado} tonoForzado={TONO_ESTADO[e.estado]} />}
              />
            ))}
          </ListRowGrupo>
        )}

        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} style={{ textAlign: "center" }}>
          {auth.fase === "listo" ? `Conectado como ${auth.yo.nombre}` : ""}
        </Texto>
      </ScrollView>
    </View>
  );
}
