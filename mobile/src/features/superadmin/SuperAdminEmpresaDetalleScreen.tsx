import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import type { Empresa, EstadoEmpresa, Modulo, Plan } from "@bitacora/shared";
import { ETIQUETA_PLAN } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { LoadingState, ScreenHeader, Texto, useMarca } from "@bitacora/ui/native";
import {
  cambiarEstadoEmpresa,
  cambiarModuloEmpresa,
  cambiarPlanEmpresa,
  cambiarTemaEmpresa,
  listarEmpresasSuperAdmin,
  obtenerModulosEmpresa,
  type EmpresaSuperAdmin,
  type ModuloEstado,
} from "../../services/superadmin";
import type { SuperAdminStackParamList } from "./types";

// Nombres visibles de cada módulo — mismo mapeo que
// web/src/lib/etiquetasModulo.ts (no compartido entre apps a
// propósito, igual criterio que el resto de las etiquetas de estado/
// período que cada plataforma repite las suyas).
const ETIQUETA_MODULO: Record<string, string> = {
  agenda: "Agenda",
  ordenes_servicio: "Órdenes de servicio",
  viajes: "Viajes",
  registros: "Clientes",
  equipos: "Equipos",
  inventario: "Inventario",
  catalogo: "Catálogo",
  proveedores: "Proveedores",
  rutas: "Rutas",
  // Dinero, separado en 3 desde el 23-sep-2026 (antes un solo
  // "financiero" bundleaba las 3 cosas) — ver packages/shared/src/permisos.ts.
  financiero: "Gastos y rendiciones",
  cotizaciones: "Cotizaciones",
  cobros: "Cobros",
  informes: "Informes",
  informe_ia: "Informe con IA",
  asistente: "Asistente",
  configuracion: "Configuración",
  gestion_control: "Grupo y usuario",
  flota: "Flota",
  agenda_pro: "Agenda Pro",
  remuneraciones: "Remuneraciones",
  levantamientos: "Levantamientos",
};

const ESTADOS: { valor: EstadoEmpresa; label: string }[] = [
  { valor: "activa", label: "Activa" },
  { valor: "suspendida", label: "Suspendida" },
  { valor: "dada_de_baja", label: "Dada de baja" },
];
// Operación se asigna con el pack que ya tenga la empresa (o Transporte);
// para elegir otro pack, usar el panel web.
const PLANES: { valor: Plan; label: string }[] = (["trial", "basico", "operacion", "pro", "empresa"] as const).map((valor) => ({
  valor,
  label: ETIQUETA_PLAN[valor],
}));
// Mismas 3 opciones que Configuración > Empresa > "Tema visual" (web).
const TEMAS: { valor: Empresa["tema"]; label: string }[] = [
  { valor: "faena", label: "Faena" },
  { valor: "taller", label: "Taller" },
  { valor: "confianza", label: "Confianza" },
];

// Fase 1 del panel de Super-Admin en mobile — detalle básico: estado y
// plan (con confirmación, son cambios sensibles que afectan lo que la
// empresa puede usar) + módulos (toggle individual, mismo endpoint que
// la web). Deliberadamente NO incluye lo demás del detalle web (salud,
// usuarios, accesos, impersonar, anonimizar, exportar) — eso queda
// para una fase 2 si se pide.
export function SuperAdminEmpresaDetalleScreen({ route, navigation }: NativeStackScreenProps<SuperAdminStackParamList, "EmpresaDetalle">) {
  const empresaId = route.params.id;
  const marca = useMarca();
  const [empresa, setEmpresa] = useState<EmpresaSuperAdmin | null>(null);
  const [modulos, setModulos] = useState<ModuloEstado[] | null>(null);
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [moduloGuardando, setModuloGuardando] = useState<Modulo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    // No hay GET /empresas/:id dedicado — se reusa la lista y se filtra
    // (mismo dato que ya muestra SuperAdminEmpresasListScreen).
    const [lista, mods] = await Promise.all([listarEmpresasSuperAdmin(), obtenerModulosEmpresa(empresaId)]);
    setEmpresa(lista.find((e) => e.id === empresaId) ?? null);
    setModulos(mods);
  }, [empresaId]);

  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function onCambiarEstado(nuevo: EstadoEmpresa) {
    if (!empresa || nuevo === empresa.estado) return;
    Alert.alert("Cambiar estado", `¿Pasar "${empresa.nombre}" a ${ESTADOS.find((e) => e.valor === nuevo)?.label}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          setGuardandoEstado(true);
          setError(null);
          const r = await cambiarEstadoEmpresa(empresaId, nuevo);
          setGuardandoEstado(false);
          if (!r.ok) return setError(r.error);
          await cargar();
        },
      },
    ]);
  }

  async function onCambiarTema(nuevo: Empresa["tema"]) {
    if (!empresa || nuevo === empresa.tema) return;
    setGuardandoTema(true);
    setError(null);
    const r = await cambiarTemaEmpresa(empresaId, nuevo);
    setGuardandoTema(false);
    if (!r.ok) return setError(r.error);
    await cargar();
  }

  async function onCambiarPlan(nuevo: Plan) {
    if (!empresa || nuevo === empresa.plan) return;
    Alert.alert("Cambiar plan", `¿Pasar "${empresa.nombre}" a ${PLANES.find((p) => p.valor === nuevo)?.label}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          setGuardandoPlan(true);
          setError(null);
          const r = await cambiarPlanEmpresa(empresaId, nuevo);
          setGuardandoPlan(false);
          if (!r.ok) return setError(r.error);
          await cargar();
        },
      },
    ]);
  }

  async function onCambiarModulo(modulo: Modulo, activado: boolean) {
    setModuloGuardando(modulo);
    setError(null);
    const r = await cambiarModuloEmpresa(empresaId, modulo, activado);
    setModuloGuardando(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    await cargar();
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!empresa || !modulos) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Empresa" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo={empresa.nombre} accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["6"], paddingBottom: tokens.space["8"] }}>
        {error ? (
          <Texto tamano={tokens.size.small} color={tokens.color.accentRamp["700"]}>
            {error}
          </Texto>
        ) : null}

        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.small} peso="semibold" color={`${tokens.color.text}99`}>
            Estado
          </Texto>
          <View style={{ flexDirection: "row", gap: tokens.space["2"], flexWrap: "wrap" }}>
            {ESTADOS.map((e) => (
              <Chip key={e.valor} marca={marca} activo={e.valor === empresa.estado} label={e.label} onPress={() => onCambiarEstado(e.valor)} cargando={guardandoEstado} />
            ))}
          </View>
        </View>

        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.small} peso="semibold" color={`${tokens.color.text}99`}>
            Plan
          </Texto>
          <View style={{ flexDirection: "row", gap: tokens.space["2"], flexWrap: "wrap" }}>
            {PLANES.map((p) => (
              <Chip key={p.valor} marca={marca} activo={p.valor === empresa.plan} label={p.label} onPress={() => onCambiarPlan(p.valor)} cargando={guardandoPlan} />
            ))}
          </View>
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
            {empresa.cantidad_usuarios} usuario{empresa.cantidad_usuarios === 1 ? "" : "s"} · creada {empresa.creado_en.slice(0, 10)}
          </Texto>
        </View>

        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.small} peso="semibold" color={`${tokens.color.text}99`}>
            Tema visual
          </Texto>
          <View style={{ flexDirection: "row", gap: tokens.space["2"], flexWrap: "wrap" }}>
            {TEMAS.map((t) => (
              <Chip key={t.valor} marca={marca} activo={t.valor === empresa.tema} label={t.label} onPress={() => onCambiarTema(t.valor)} cargando={guardandoTema} />
            ))}
          </View>
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
            Estilo con que los usuarios de la empresa ven la app, en web y mobile.
          </Texto>
        </View>

        <View style={{ gap: tokens.space["1"] }}>
          <Texto tamano={tokens.size.small} peso="semibold" color={`${tokens.color.text}99`} style={{ marginBottom: tokens.space["1"] }}>
            Módulos
          </Texto>
          {modulos.map((m) => (
            <View
              key={m.modulo}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: tokens.space["2"],
                borderBottomWidth: 1,
                borderBottomColor: tokens.color.divider,
              }}
            >
              <Texto tamano={tokens.size.body} color={tokens.color.text} style={{ flex: 1, marginRight: tokens.space["2"] }}>
                {ETIQUETA_MODULO[m.modulo] ?? m.modulo}
              </Texto>
              <Switch
                value={m.activado}
                onValueChange={(v) => onCambiarModulo(m.modulo, v)}
                disabled={moduloGuardando === m.modulo}
                trackColor={{ true: marca.base, false: tokens.color.divider }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function Chip({
  activo,
  label,
  onPress,
  cargando,
  marca,
}: {
  activo: boolean;
  label: string;
  onPress: () => void;
  cargando: boolean;
  marca: ReturnType<typeof useMarca>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      style={{
        minHeight: 40,
        paddingHorizontal: tokens.space["3"],
        alignItems: "center",
        justifyContent: "center",
        borderRadius: tokens.radius.pill,
        backgroundColor: activo ? marca.suave : tokens.color.surface,
        borderWidth: 1,
        borderColor: activo ? marca.base : tokens.color.divider,
        opacity: cargando ? 0.6 : 1,
      }}
    >
      <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : `${tokens.color.text}99`}>
        {label}
      </Texto>
    </Pressable>
  );
}
