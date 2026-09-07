import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { TipoPack } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, PickerBuscable, Text } from "../../components/ui";
import { InputMonto } from "../../components/InputMonto";
import { formatearMoneda } from "../../lib/plata";
import { listarTiposPack } from "../../services/tiposPack";
import { crearPaquete } from "../../services/paquetes";

/**
 * Asignar/vender un pack del catálogo a un cliente (crea la instancia).
 * El backend copia nombre/cantidad/precio/vigencia del catálogo — acá
 * solo se elige el tipo y, opcional, el precio realmente cobrado.
 */
export function AsignarPackModal({
  visible,
  clienteId,
  onCerrar,
  onAsignado,
}: {
  visible: boolean;
  clienteId: string;
  onCerrar: () => void;
  onAsignado: () => void;
}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [tipos, setTipos] = useState<TipoPack[]>([]);
  const [tipoId, setTipoId] = useState("");
  const [precioPagado, setPrecioPagado] = useState(""); // solo dígitos
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visible) {
      setTipoId("");
      setPrecioPagado("");
      listarTiposPack().then(setTipos);
    }
  }, [visible]);

  const tipo = tipos.find((x) => x.id === tipoId) ?? null;

  function elegirTipo(id: string) {
    setTipoId(id);
    const tp = tipos.find((x) => x.id === id);
    setPrecioPagado(tp?.precio != null ? String(tp.precio) : "");
  }

  async function asignar() {
    if (!tipoId) return Alert.alert("Falta el tipo", "Elige un tipo de pack del catálogo.");
    setGuardando(true);
    const r = await crearPaquete({
      cliente_id: clienteId,
      tipo_pack_id: tipoId,
      nombre: tipo?.nombre ?? "Pack",
      cantidad_total: tipo?.cantidad_sesiones ?? 1,
      precio_pagado: precioPagado ? Number(precioPagado) : null,
    });
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo asignar", r.error);
    onAsignado();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.espacio(3),
            paddingHorizontal: t.espacio(4),
            paddingTop: t.espacio(12),
            paddingBottom: t.espacio(3),
            borderBottomWidth: 1,
            borderBottomColor: t.colores.border,
          }}
        >
          <Pressable onPress={onCerrar} hitSlop={12}>
            <Ionicons name="close" size={24} color={t.colores.foreground} />
          </Pressable>
          <Text variante="subtitulo" style={{ flex: 1 }}>
            Asignar pack
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: t.espacio(5), paddingBottom: t.espacio(5) + insets.bottom, gap: t.espacio(4) }} keyboardShouldPersistTaps="handled">
          {tipos.length === 0 ? (
            <Text variante="cuerpo" tono="muted">
              No hay tipos de pack en el catálogo. Créalos desde la web (Configuración → Agenda Pro).
            </Text>
          ) : (
            <>
              <PickerBuscable
                etiqueta="Tipo de pack"
                placeholder="Elegir del catálogo"
                valor={tipoId}
                opciones={tipos.map((tp) => ({
                  id: tp.id,
                  label: tp.nombre,
                  sublabel: `${tp.cantidad_sesiones} sesiones${tp.precio != null ? ` · lista ${formatearMoneda(tp.precio)}` : ""}`,
                }))}
                onElegir={elegirTipo}
              />

              {tipo ? (
                <View style={{ backgroundColor: t.colores.surfaceAlt, borderRadius: t.radio.md, padding: t.espacio(3), gap: t.espacio(1) }}>
                  <Text variante="caption" tono="muted">
                    Se copia del catálogo: {tipo.cantidad_sesiones} sesiones
                    {tipo.precio != null ? ` · lista ${formatearMoneda(tipo.precio)}` : ""}
                    {tipo.vigencia_dias != null ? ` · vence a los ${tipo.vigencia_dias} días` : ""}. Si el catálogo cambia después,
                    este pack no se ve afectado.
                  </Text>
                </View>
              ) : null}

              <InputMonto etiqueta="Precio pagado (opcional)" valor={precioPagado} onChangeText={setPrecioPagado} ayuda="Vacío = el precio de lista." />

              <Button titulo="Asignar pack" tamano="lg" onPress={asignar} cargando={guardando} />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
