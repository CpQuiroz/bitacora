import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoSuscripcion } from "@bitacora/shared";
import { ETIQUETA_PLAN, NOMBRE_MODULO } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Card, ErrorState, LoadingState, ScreenHeader, StatusBadge, Texto, useMarca, type TonoEstado } from "@bitacora/ui/native";
import { obtenerMiPlan, type InfoMiPlan } from "../../services/plan";
import type { MasStackParamList } from "../../shell/navigation/types";

const ETIQUETA_ESTADO: Record<EstadoSuscripcion, string> = {
  trial: "En prueba",
  activa: "Activa",
  pago_pendiente: "Pago pendiente",
  suspendida_por_pago: "Suspendida por pago",
  cancelada: "Cancelada",
};
const TONO_ESTADO: Record<EstadoSuscripcion, TonoEstado> = {
  trial: "en_progreso",
  activa: "completado",
  pago_pendiente: "advertencia",
  suspendida_por_pago: "peligro",
  cancelada: "cancelado",
};
const ETIQUETA_COBRO: Record<string, string> = { exitoso: "Pagado", fallido: "Rechazado", pendiente: "Pendiente" };
const TONO_COBRO: Record<string, TonoEstado> = { exitoso: "completado", fallido: "peligro", pendiente: "en_progreso" };

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;
const uf = (n: number) => `${n.toLocaleString("es-CL")} UF`;
const fecha = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

function diasRestantes(fin: string | null): number | null {
  if (!fin) return null;
  const hoy = new Date();
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  return Math.ceil((new Date(`${fin}T00:00:00`).getTime() - base) / 86_400_000);
}

// "Mi plan" (23-sep-2026) — solo Admin (acción gestionar_plan), SOLO
// LECTURA: plan, precio (UF y CLP al valor del día, tarea 151), módulos
// activos, límites y consumo, estado del pago y últimos cobros.
// Sin botones de pagar/cambiar plan ni links a Flow, a propósito (reglas
// de Google Play) — eso se hace en la web, Configuración > Plan.
export function MiPlanScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "MiPlan">) {
  const marca = useMarca();
  const [info, setInfo] = useState<InfoMiPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setInfo(await obtenerMiPlan());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el plan");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!info) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Mi plan" accion={volver} />
        {error ? <ErrorState mensaje={error} onReintentar={() => void cargar()} /> : <View style={{ padding: tokens.space["4"] }}><LoadingState /></View>}
      </View>
    );
  }

  const sus = info.suscripcion;
  const dias = info.planActual === "trial" ? diasRestantes(info.pruebaTerminaEn) : null;
  const alerta =
    sus?.estado === "suspendida_por_pago"
      ? "La cuenta está suspendida porque no se pudo cobrar. Actualiza el medio de pago desde la web."
      : sus?.estado === "pago_pendiente"
        ? "El último cobro no se pudo hacer. Revisa el medio de pago desde la web."
        : info.trialVencido
          ? "La prueba gratis terminó. Elige un plan desde la web para seguir usando Bitácora."
          : null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Mi plan" accion={volver} />
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}
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
        <View style={{ backgroundColor: marca.suave, borderRadius: 32, padding: tokens.space["6"], gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.micro} color={`${marca.fuerte}b3`} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
            Plan actual
          </Texto>
          <Texto tamano={30} peso="semibold" color={marca.fuerte}>
            {ETIQUETA_PLAN[info.planActual] ?? info.planActual}
          </Texto>
          {dias != null ? (
            <Texto tamano={tokens.size.small} color={`${marca.fuerte}b3`}>
              {dias > 0 ? `Quedan ${dias} día${dias === 1 ? "" : "s"} de prueba` : "La prueba terminó"}
            </Texto>
          ) : null}
          {info.precio ? (
            <View style={{ gap: 2, marginTop: tokens.space["1"] }}>
              <Texto tamano={tokens.size.body} peso="semibold" color={marca.fuerte} style={{ fontVariant: ["tabular-nums"] }}>
                {uf(info.precio.uf)} + IVA al mes{info.precio.clp != null ? ` · ${clp(info.precio.clp)} + IVA` : ""}
              </Texto>
              {info.precio.valorUf != null && info.precio.fechaUf ? (
                <Texto tamano={tokens.size.caption} color={`${marca.fuerte}b3`}>
                  {info.precio.ufDelDia ? "UF de hoy" : `UF del ${fecha(info.precio.fechaUf)} (último valor disponible)`}: {clp(Math.round(info.precio.valorUf * 100) / 100)}
                </Texto>
              ) : (
                <Texto tamano={tokens.size.caption} color={`${marca.fuerte}b3`}>
                  Valor en pesos no disponible por ahora.
                </Texto>
              )}
            </View>
          ) : null}
        </View>

        {alerta ? (
          <View style={{ backgroundColor: tokens.semantic.dangerSoft, borderRadius: tokens.radius.md, padding: tokens.space["3"] }}>
            <Texto tamano={tokens.size.small} peso="semibold" color={tokens.semantic.danger}>
              {alerta}
            </Texto>
          </View>
        ) : null}

        <Card>
          <View style={{ gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
              Módulos activos
            </Texto>
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              {info.modulosMax != null ? `${info.modulosActivos.length} de ${info.modulosMax} que permite tu plan` : `${info.modulosActivos.length} activos (tu plan no tiene tope)`}
            </Texto>
            {info.modulosActivos.length > 0 ? (
              <Texto tamano={tokens.size.small} color={tokens.color.text}>
                {info.modulosActivos.map((m) => NOMBRE_MODULO[m] ?? m).join(" · ")}
              </Texto>
            ) : null}
          </View>
        </Card>

        {info.consumo ? (
          <Card>
            <View style={{ gap: tokens.space["2"] }}>
              <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
                Límites y consumo
              </Texto>
              <Fila etiqueta="Usuarios activos" valor={`${info.consumo.usuarios.usados} de ${info.consumo.usuarios.tope}`} />
              <Fila etiqueta="OS este mes" valor={info.consumo.osMes.tope != null ? `${info.consumo.osMes.usados} de ${info.consumo.osMes.tope}` : `${info.consumo.osMes.usados} (sin límite)`} />
              <Fila etiqueta="Almacenamiento" valor={`${info.consumo.almacenamiento.usadoGB.toLocaleString("es-CL")} de ${info.consumo.almacenamiento.topeGB} GB`} />
              <Fila
                etiqueta={info.consumo.informesIA.periodo === "prueba" ? "Informes con IA (prueba)" : "Informes con IA este mes"}
                valor={info.consumo.informesIA.tope != null ? `${info.consumo.informesIA.usados} de ${info.consumo.informesIA.tope}` : `${info.consumo.informesIA.usados} (sin límite)`}
              />
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={{ gap: tokens.space["2"] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
                Suscripción
              </Texto>
              {sus ? <StatusBadge estado={sus.estado} etiqueta={ETIQUETA_ESTADO[sus.estado]} tonoForzado={TONO_ESTADO[sus.estado]} /> : null}
            </View>
            <Fila etiqueta="Medio de pago" valor={sus?.tarjeta_ultimos4 ? `${sus.tarjeta_marca ?? "Tarjeta"} •••• ${sus.tarjeta_ultimos4}` : "Sin tarjeta registrada"} />
            <Fila etiqueta="Próximo cobro" valor={sus?.proxima_fecha_cobro ? fecha(sus.proxima_fecha_cobro) : "—"} />
            {sus?.plan_pendiente ? <Fila etiqueta="Cambio programado" valor={`A ${ETIQUETA_PLAN[sus.plan_pendiente]}`} /> : null}
          </View>
        </Card>

        <Card>
          <View style={{ gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text}>
              Últimos cobros
            </Texto>
            {info.cobros.length === 0 ? (
              <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
                Todavía no hay cobros.
              </Texto>
            ) : (
              info.cobros.slice(0, 12).map((c) => (
                <View key={c.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: tokens.color.divider, paddingVertical: tokens.space["2"] }}>
                  <View>
                    <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text}>
                      {clp(c.monto)}
                    </Texto>
                    <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
                      {fecha(c.creado_en)}
                    </Texto>
                  </View>
                  <StatusBadge estado={c.estado} etiqueta={ETIQUETA_COBRO[c.estado] ?? c.estado} tonoForzado={TONO_COBRO[c.estado]} />
                </View>
              ))
            )}
          </View>
        </Card>

        <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ textAlign: "center" }}>
          El cambio de plan y el medio de pago se gestionan en Bitácora web: Configuración → Plan.
        </Texto>
      </ScrollView>
    </View>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: tokens.space["3"] }}>
      <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
        {etiqueta}
      </Texto>
      <Texto tamano={tokens.size.small} color={tokens.color.text} style={{ flexShrink: 1, textAlign: "right" }}>
        {valor}
      </Texto>
    </View>
  );
}
