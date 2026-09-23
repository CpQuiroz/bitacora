import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { ArrowLeft, ClipboardList } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { EmptyState, Input, ListRow, ListRowGrupo, LoadingState, ScreenHeader, StatusBadge, Texto, type TonoEstado } from "@bitacora/ui/native";
import { listarMisTrabajos, obtenerUrlPdfTrabajo, type ItemHistorialTrabajo } from "../../services/misTrabajos";
import type { MasStackParamList } from "../../shell/navigation/types";

const ETIQUETA_TIPO: Record<"os" | "levantamiento", string> = { os: "OS", levantamiento: "Levantamiento" };
const ETIQUETA_ESTADO: Record<string, string> = {
  completada: "Completada",
  firmada: "Firmada",
  cancelada: "Cancelada",
  completado_tecnico: "Completado",
  cotizado_externo: "Cotizado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};
const TONO_ESTADO: Record<string, TonoEstado> = {
  completada: "completado",
  firmada: "completado",
  cancelada: "cancelado",
  completado_tecnico: "completado",
  cotizado_externo: "en_progreso",
  aprobado: "completado",
  rechazado: "cancelado",
};

// Fase 5.3 — "Mis trabajos" (mobile): historial de levantamientos/OS
// terminados, sin fecha de vencimiento (default 30 días, extendible a
// 90), solo lectura, con acceso al PDF (última versión) de las OS.
// Mismo patrón visual que LevantamientosListScreen: ScreenHeader
// propio con 2 filas de chips (tipo + rango de días).
export function MisTrabajosScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "MisTrabajos">) {
  const [dias, setDias] = useState<"30" | "90">("30");
  const [tipo, setTipo] = useState<"todos" | "os" | "levantamiento">("todos");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ItemHistorialTrabajo[] | null>(null);
  const [abriendoPdfId, setAbriendoPdfId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await listarMisTrabajos({ dias: dias === "90" ? 90 : 30, tipo: tipo === "todos" ? undefined : tipo, q, limite: 100 });
    setItems(r.items);
  }, [dias, tipo, q]);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function abrirPdf(item: ItemHistorialTrabajo) {
    setAbriendoPdfId(item.id);
    const url = await obtenerUrlPdfTrabajo(item.id);
    setAbriendoPdfId(null);
    if (url) void Linking.openURL(url);
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        titulo="Mis trabajos"
        accion={volver}
        filtros={{
          opciones: [
            { valor: "todos", etiqueta: "Todos" },
            { valor: "os", etiqueta: "OS" },
            { valor: "levantamiento", etiqueta: "Levantamientos" },
          ],
          valor: tipo,
          onCambio: (v) => setTipo(v as typeof tipo),
        }}
        filtrosSecundarios={{
          opciones: [
            { valor: "30", etiqueta: "30 días" },
            { valor: "90", etiqueta: "90 días" },
          ],
          valor: dias,
          onCambio: (v) => setDias(v as typeof dias),
        }}
      />
      <View style={{ paddingHorizontal: tokens.space["4"], paddingTop: tokens.space["3"] }}>
        <Input valor={q} onCambio={setQ} placeholder="Buscar por cliente" />
      </View>
      {items === null ? (
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: tokens.space["4"], flexGrow: 1 }}>
          {items.length === 0 ? (
            <EmptyState
              icono={<ClipboardList size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
              titulo="Sin trabajos en este período"
              mensaje="Probá extender a 90 días o cambiar el filtro."
            />
          ) : (
            <ListRowGrupo>
              {items.map((item) => (
                <ListRow
                  key={`${item.tipo}:${item.id}`}
                  icono={<ClipboardList size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                  titulo={item.cliente_nombre}
                  subtitulo={[ETIQUETA_TIPO[item.tipo], item.folio != null ? `#${item.folio}` : null, item.fecha].filter(Boolean).join(" · ")}
                  onPress={item.tipo === "os" ? () => void abrirPdf(item) : undefined}
                  trailing={
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <StatusBadge estado={item.estado} etiqueta={ETIQUETA_ESTADO[item.estado] ?? item.estado} tonoForzado={TONO_ESTADO[item.estado]} />
                      {item.tipo === "os" ? (
                        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}66`}>
                          {abriendoPdfId === item.id ? "Abriendo…" : "Ver PDF"}
                        </Texto>
                      ) : null}
                    </View>
                  }
                />
              ))}
            </ListRowGrupo>
          )}
        </ScrollView>
      )}
    </View>
  );
}
