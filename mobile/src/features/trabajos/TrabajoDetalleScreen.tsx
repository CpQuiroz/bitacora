import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ItemChecklist } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Button, Card, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { ubicacionActual } from "../../lib/geo";
import {
  encolarCheckin,
  encolarDatos,
  encolarFinalizar,
  encolarFirma,
  encolarFoto,
  obtenerDetalle,
  type DetalleTrabajo,
} from "../../services/trabajos";
import { CamposDinamicos } from "./components/CamposDinamicos";
import { FotosSection } from "./components/FotosSection";
import { CierreFirma } from "./components/CierreFirma";
import type { TrabajosStackParamList } from "../../app/navigation/types";

export function TrabajoDetalleScreen({ route }: NativeStackScreenProps<TrabajosStackParamList, "TrabajoDetalle">) {
  const t = useTema();
  const { trabajoId } = route.params;
  const { cola } = useRed();
  const pendientesAqui = cola.filter((a) => a.recurso === `trabajo:${trabajoId}`).length;

  const [detalle, setDetalle] = useState<DetalleTrabajo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datosForm, setDatosForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [marcando, setMarcando] = useState<"Check-in" | "Check-out" | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await obtenerDetalle(trabajoId);
      setDetalle(d);
      setDatosForm(
        Object.fromEntries(Object.entries(d.trabajo.datos ?? {}).map(([k, v]) => [k, String(v ?? "")]))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el trabajo");
    }
  }, [trabajoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  if (!detalle && !error) return <LoadingScreen />;
  if (error && !detalle) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!detalle) return null;

  const { trabajo, orden, fotos } = detalle;
  const finalizada = Boolean(orden?.finalizada_en);
  const checklist: ItemChecklist[] = orden?.checklist ?? [];
  const checkIn = checklist.find((c) => c.item === "Check-in");
  const checkOut = checklist.find((c) => c.item === "Check-out");
  const puedeFinalizar = Boolean(orden?.firma_url_firmada) && Boolean(checkOut?.hecho) && !finalizada;

  async function marcar(item: "Check-in" | "Check-out") {
    setMarcando(item);
    const ubic = await ubicacionActual();
    if (!ubic) {
      Alert.alert("Sin ubicación", `Se registrará el ${item.toLowerCase()} sin coordenadas (permiso denegado o GPS no disponible).`);
    }
    await encolarCheckin(trabajoId, item, ubic);
    setMarcando(null);
    // Optimista: marcamos localmente; el fetch al volver al foco confirma.
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            orden: {
              ...(prev.orden ?? ({} as NonNullable<DetalleTrabajo["orden"]>)),
              checklist: [
                ...(prev.orden?.checklist ?? []).filter((c) => c.item !== item),
                { item, hecho: true, hora: new Date().toISOString() },
              ],
            } as DetalleTrabajo["orden"],
          }
        : prev
    );
  }

  async function guardarDatos() {
    setGuardandoDatos(true);
    await encolarDatos(trabajoId, datosForm);
    setGuardandoDatos(false);
    Alert.alert("Guardado", pendientesAqui > 0 ? "Se sincronizará cuando haya conexión." : "Formulario guardado.");
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={detalle.desdeCache ? detalle.guardadoEn : undefined} />
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4) }}>
        <View style={{ gap: t.espacio(1) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variante="titulo">{trabajo.cliente}</Text>
            <Badge estado={trabajo.estado} />
          </View>
          <Text variante="etiqueta" tono="muted">
            {trabajo.fecha}
            {trabajo.hora_programada ? ` · ${trabajo.hora_programada.slice(0, 5)}` : ""} · ${trabajo.monto.toLocaleString("es-CL")}
          </Text>
          {trabajo.ubicacion ? (
            <Text variante="etiqueta" tono="faint">
              {trabajo.ubicacion}
            </Text>
          ) : null}
          {orden?.folio != null ? (
            <Text variante="etiqueta" tono="brand" weight="semibold">
              OS N° {orden.folio}
            </Text>
          ) : null}
        </View>

        {finalizada && (
          <Card plano style={{ backgroundColor: t.colores.successSoft, borderColor: "transparent" }}>
            <Text variante="etiqueta" weight="semibold" style={{ color: t.colores.success }}>
              ✓ OS finalizada — ya no se puede editar
            </Text>
          </Card>
        )}

        {/* Check-in / out */}
        <View style={{ gap: t.espacio(3) }}>
          <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
            Check-in / Check-out
          </Text>
          <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
            <Button
              titulo={checkIn?.hecho ? `Check-in ✓ ${checkIn.hora?.slice(11, 16) ?? ""}` : "Marcar check-in"}
              variante={checkIn?.hecho ? "secundario" : "primario"}
              onPress={() => marcar("Check-in")}
              disabled={Boolean(checkIn?.hecho) || finalizada}
              cargando={marcando === "Check-in"}
            />
            <Button
              titulo={checkOut?.hecho ? `Check-out ✓ ${checkOut.hora?.slice(11, 16) ?? ""}` : "Marcar check-out"}
              variante={checkOut?.hecho ? "secundario" : "primario"}
              onPress={() => marcar("Check-out")}
              disabled={Boolean(checkOut?.hecho) || finalizada}
              cargando={marcando === "Check-out"}
            />
          </View>
        </View>

        {trabajo.tipo_trabajo ? (
          <CamposDinamicos
            nombre={trabajo.tipo_trabajo.nombre}
            campos={trabajo.tipo_trabajo.campos}
            valores={datosForm}
            onCambiar={(k, v) => setDatosForm((p) => ({ ...p, [k]: v }))}
            onGuardar={guardarDatos}
            guardando={guardandoDatos}
            editable={!finalizada}
          />
        ) : null}

        <FotosSection fotos={fotos} editable={!finalizada} onAgregar={(archivo) => encolarFoto(trabajoId, archivo)} />

        <CierreFirma orden={orden} editable={!finalizada} onFirmar={(p) => encolarFirma(trabajoId, p)} />

        {!finalizada && (
          <>
            <Button
              titulo="Finalizar OS"
              onPress={() => encolarFinalizar(trabajoId)}
              disabled={!puedeFinalizar}
              style={{ marginTop: t.espacio(2) }}
            />
            {!puedeFinalizar && (
              <Text variante="caption" tono="faint" style={{ textAlign: "center" }}>
                Para finalizar: marca el check-out y registra la firma del cliente.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
