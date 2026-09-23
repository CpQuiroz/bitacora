import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Building2, LogOut, Plus } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { EmptyState, Input, ListRow, ListRowGrupo, LoadingState, ScreenHeader, StatusBadge, Texto, useMarca, type TonoEstado } from "@bitacora/ui/native";
import { listarEmpresasSuperAdmin, type EmpresaSuperAdmin } from "../../services/superadmin";
import type { Empresa } from "@bitacora/shared";
import { useSuperAdminAuth } from "./SuperAdminAuthContext";
import { Chip } from "./SuperAdminEmpresaDetalleScreen";
import type { SuperAdminStackParamList } from "./types";

const ETIQUETA_ESTADO: Record<string, string> = { activa: "Activa", suspendida: "Suspendida", dada_de_baja: "Dada de baja" };
const TONO_ESTADO: Record<string, TonoEstado> = { activa: "completado", suspendida: "en_progreso", dada_de_baja: "cancelado" };
const ETIQUETA_PLAN: Record<string, string> = { trial: "Trial", basico: "Básico", pro: "Pro" };
const TEMAS: { valor: Empresa["tema"]; label: string }[] = [
  { valor: "faena", label: "Faena" },
  { valor: "taller", label: "Taller" },
  { valor: "confianza", label: "Confianza" },
];

// Fase 1 del panel de Super-Admin en mobile — lista de todas las
// empresas (mismo endpoint que el panel web, GET /api/superadmin/empresas).
// A propósito no cachea nada localmente (ver SuperAdminAuthContext).
export function SuperAdminEmpresasListScreen({ navigation }: NativeStackScreenProps<SuperAdminStackParamList, "EmpresasLista">) {
  const auth = useSuperAdminAuth();
  const marca = useMarca();
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [errorTema, setErrorTema] = useState<string | null>(null);
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

  async function onCambiarTema(tema: Empresa["tema"]) {
    if (auth.fase !== "listo" || tema === auth.yo.tema) return;
    setGuardandoTema(true);
    setErrorTema(null);
    const r = await auth.cambiarTema(tema);
    setGuardandoTema(false);
    if (!r.ok) setErrorTema(r.error);
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

        {auth.fase === "listo" ? (
          <View style={{ gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.small} peso="semibold" color={`${tokens.color.text}99`}>
              Mi estilo
            </Texto>
            <View style={{ flexDirection: "row", gap: tokens.space["2"], flexWrap: "wrap" }}>
              {TEMAS.map((t) => (
                <Chip key={t.valor} marca={marca} activo={t.valor === auth.yo.tema} label={t.label} onPress={() => onCambiarTema(t.valor)} cargando={guardandoTema} />
              ))}
            </View>
            {errorTema ? (
              <Texto tamano={tokens.size.small} color={tokens.color.accentRamp["700"]}>
                {errorTema}
              </Texto>
            ) : null}
          </View>
        ) : null}

        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`} style={{ textAlign: "center" }}>
          {auth.fase === "listo" ? `Conectado como ${auth.yo.nombre}` : ""}
        </Texto>
      </ScrollView>
      <FabNuevaEmpresa onPress={() => navigation.navigate("NuevaEmpresa")} />
    </View>
  );
}

function FabNuevaEmpresa({ onPress }: { onPress: () => void }) {
  const marca = useMarca();
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        right: 18,
        bottom: 24,
        width: 56,
        height: 56,
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
      <Plus size={26} strokeWidth={2.5} color={tokens.color.bg} />
    </Pressable>
  );
}
