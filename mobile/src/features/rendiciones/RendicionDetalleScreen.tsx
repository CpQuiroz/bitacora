import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { ArrowLeft, ChevronRight, Paperclip, Plus } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoRendicion } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, EmptyState, ListRow, ListRowGrupo, LoadingState, ScreenHeader, StatusBadge, Texto, useConfirmar, useToast, type TonoEstado } from "@bitacora/ui/native";
import { enviarRendicion, obtenerRendicion, type DetalleRendicion } from "../../services/rendiciones";
import { useAuth } from "../auth/AuthContext";
import type { MasStackParamList } from "../../shell/navigation/types";

const ETIQUETA_ESTADO: Record<EstadoRendicion, string> = {
  borrador: "Borrador",
  enviada: "Enviada — esperando revisión",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const TONO_ESTADO: Record<EstadoRendicion, TonoEstado> = {
  borrador: "cerrado",
  enviada: "en_progreso",
  aprobada: "completado",
  rechazada: "cancelado",
};

const ETIQUETA_PERIODO: Record<string, string> = { diario: "Diario", semanal: "Semanal" };
const ETIQUETA_METODO_ENTREGA: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia" };

// Detalle de una rendición (Más → Rendiciones → tocar una) — "Agregar
// gasto" reusa el formulario de Nuevo Gasto (NuevoGastoScreen) con
// rendicionId fijo y foto obligatoria; "Enviar rendición" la bloquea
// para seguir agregando (el backend además exige que todos los gastos
// ya tengan su comprobante subido). Tocar un gasto ya agregado abre el
// mismo formulario en modo edición (gastoId) para corregirlo y ver la
// foto que se subió — de solo lectura si la rendición ya no está en
// borrador o el que mira no es el dueño ni gestión (22-sep-2026,
// pedido explícito: "si creé el gasto igual debiera poder
// modificarlo").
export function RendicionDetalleScreen({ navigation, route }: NativeStackScreenProps<MasStackParamList, "RendicionDetalle">) {
  const auth = useAuth();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [detalle, setDetalle] = useState<DetalleRendicion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await obtenerRendicion(route.params.id);
    if (r.ok) {
      setDetalle(r.detalle);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [route.params.id]);

  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  const esDueno = auth.fase === "listo" && detalle?.colaborador?.id === auth.usuario.id;
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const puedeEditar = detalle?.estado === "borrador" && (esDueno || esGestion);

  async function onEnviar() {
    if (!detalle) return;
    const ok = await confirmar({
      titulo: "¿Enviar esta rendición?",
      mensaje: "Ya no vas a poder agregar más gastos hasta que se revise.",
      accion: "Enviar",
    });
    if (!ok) return;
    setEnviando(true);
    const r = await enviarRendicion(detalle.id);
    setEnviando(false);
    if (!r.ok) return toast(`No se pudo enviar: ${r.error}`, { tono: "error" });
    await cargar();
  }

  if (!detalle && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Rendición" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Rendición" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <Texto tamano={tokens.size.small} color={tokens.color.accentRamp["700"]}>
            {error}
          </Texto>
        </View>
      </View>
    );
  }
  if (!detalle) return null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo={formatearFolio("REND", detalle.folio) ?? "Rendición"} accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            {ETIQUETA_PERIODO[detalle.periodo] ?? detalle.periodo} · {detalle.fecha_inicio} a {detalle.fecha_termino} ·{" "}
            {ETIQUETA_METODO_ENTREGA[detalle.metodo_entrega] ?? detalle.metodo_entrega}
            {detalle.colaborador ? ` · ${detalle.colaborador.nombre}` : ""}
          </Texto>
          <StatusBadge estado={detalle.estado} etiqueta={ETIQUETA_ESTADO[detalle.estado]} tonoForzado={TONO_ESTADO[detalle.estado]} />
        </View>

        {detalle.motivo_rechazo ? (
          <View style={{ borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.color.accentRamp["700"], backgroundColor: `${tokens.color.accentRamp["200"]}66`, padding: tokens.space["3"] }}>
            <Texto tamano={tokens.size.caption} peso="semibold" color={tokens.color.accentRamp["700"]}>
              Motivo del último rechazo
            </Texto>
            <Texto tamano={tokens.size.small} color={tokens.color.text} style={{ marginTop: 4 }}>
              {detalle.motivo_rechazo}
            </Texto>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
          <ResumenCard etiqueta="Entregado" valor={detalle.monto_entregado} />
          <ResumenCard etiqueta="Gastado" valor={detalle.total_gastado} />
          <ResumenCard etiqueta="Saldo" valor={detalle.saldo} />
        </View>

        <View style={{ gap: tokens.space["2"] }}>
          <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text}>
            Gastos incluidos
          </Texto>
          {detalle.gastos.length === 0 ? (
            <EmptyState icono={<Plus size={28} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />} titulo="Todavía sin gastos" mensaje="Tocá 'Agregar gasto' para empezar." />
          ) : (
            <ListRowGrupo>
              {detalle.gastos.map((g) => (
                <ListRow
                  key={g.id}
                  icono={g.comprobante_url ? <Paperclip size={20} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} /> : undefined}
                  titulo={g.categoria_info?.nombre ?? g.categoria}
                  subtitulo={[g.fecha, g.descripcion, !g.comprobante_url ? "Sin comprobante todavía" : null].filter(Boolean).join(" · ")}
                  // Tocable siempre — el dueño (o gestión) quiere poder
                  // revisar la foto que subió y corregirse si se
                  // equivocó; una vez que la rendición deja "borrador"
                  // se abre igual pero solo para mirar (soloLectura).
                  onPress={() => navigation.navigate("GastoForm", { gastoId: g.id, rendicionId: detalle.id, soloLectura: !puedeEditar })}
                  trailing={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                        ${Number(g.monto).toLocaleString("es-CL")}
                      </Texto>
                      <ChevronRight size={18} strokeWidth={2.25} color={tokens.color.textSecondary} />
                    </View>
                  }
                />
              ))}
            </ListRowGrupo>
          )}
        </View>

        {puedeEditar ? (
          <View style={{ gap: tokens.space["2"] }}>
            <Button
              variante="secundario"
              bloque
              iconoIzq={<Plus size={18} strokeWidth={2.75} />}
              onPress={() => navigation.navigate("GastoForm", { rendicionId: detalle.id })}
            >
              Agregar gasto
            </Button>
            <Button bloque onPress={onEnviar} cargando={enviando}>
              Enviar rendición
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ResumenCard({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <View style={{ flex: 1, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.color.divider, padding: tokens.space["3"], gap: 4 }}>
      <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
        {etiqueta}
      </Texto>
      <Texto tamano={tokens.size.body} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
        ${valor.toLocaleString("es-CL")}
      </Texto>
    </View>
  );
}
