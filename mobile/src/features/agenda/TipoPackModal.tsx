import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Servicio, TipoPack } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Input, PickerBuscable, Text } from "../../components/ui";
import { InputMonto } from "../../components/InputMonto";
import { crearTipoPack, editarTipoPack } from "../../services/tiposPack";

/**
 * Alta y edición de un tipo de pack del catálogo (Agenda Pro): plantilla
 * con nombre, cantidad de sesiones, precio, servicio asociado y vigencia.
 * Con `tipoPack` abre en modo edición.
 */
export function TipoPackModal({
  visible,
  tipoPack,
  servicios,
  onCerrar,
  onGuardado,
}: {
  visible: boolean;
  tipoPack?: TipoPack | null;
  servicios: Servicio[];
  onCerrar: () => void;
  onGuardado: (tp: TipoPack) => void;
}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const editando = Boolean(tipoPack);
  const [nombre, setNombre] = useState(tipoPack?.nombre ?? "");
  const [sesiones, setSesiones] = useState(tipoPack ? String(tipoPack.cantidad_sesiones) : "5");
  const [precio, setPrecio] = useState(tipoPack?.precio != null ? String(tipoPack.precio) : "");
  const [vigenciaDias, setVigenciaDias] = useState(tipoPack?.vigencia_dias != null ? String(tipoPack.vigencia_dias) : "");
  const [servicioId, setServicioId] = useState(tipoPack?.servicio_id ?? "");
  const [activo, setActivo] = useState(tipoPack?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return Alert.alert("Falta el nombre", "Ponle un nombre al pack.");
    const cant = Number(sesiones.replace(/\D/g, ""));
    if (!Number.isInteger(cant) || cant <= 0) return Alert.alert("Sesiones inválidas", "Debe ser un número mayor a 0.");
    const precioNum = precio.trim() ? Number(precio.replace(/\D/g, "")) : null;
    const vig = vigenciaDias.trim() ? Number(vigenciaDias.replace(/\D/g, "")) : null;
    if (vig !== null && (!Number.isInteger(vig) || vig <= 0)) return Alert.alert("Vigencia inválida", "Días mayor a 0, o vacío para no vencer.");

    const cuerpo = {
      nombre: nombreLimpio,
      cantidad_sesiones: cant,
      precio: precioNum,
      servicio_id: servicioId || null,
      vigencia_dias: vig,
    };

    setGuardando(true);
    const r = tipoPack ? await editarTipoPack(tipoPack.id, { ...cuerpo, activo }) : await crearTipoPack(cuerpo);
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
    onGuardado(r.tipoPack);
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
            {editando ? "Editar pack" : "Nuevo pack"}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: t.espacio(5), paddingBottom: t.espacio(5) + insets.bottom, gap: t.espacio(4) }} keyboardShouldPersistTaps="handled">
          <Input etiqueta="Nombre" placeholder="Ej: Pack 10 limpiezas" value={nombre} onChangeText={setNombre} autoFocus={!editando} />
          <Input
            etiqueta="Cantidad de sesiones"
            keyboardType="numeric"
            value={sesiones}
            onChangeText={(v) => setSesiones(v.replace(/\D/g, ""))}
          />
          <InputMonto etiqueta="Precio del pack" valor={precio} onChangeText={setPrecio} />
          {servicios.length > 0 ? (
            <PickerBuscable
              etiqueta="Servicio asociado (opcional)"
              placeholder="Sin servicio"
              opcionVacia="Sin servicio"
              valor={servicioId}
              opciones={servicios.map((s) => ({ id: s.id, label: s.nombre }))}
              onElegir={setServicioId}
            />
          ) : null}
          <Input
            etiqueta="Vigencia en días (opcional)"
            keyboardType="numeric"
            placeholder="Vacío = no vence"
            value={vigenciaDias}
            onChangeText={(v) => setVigenciaDias(v.replace(/\D/g, ""))}
          />

          {editando ? (
            <Pressable
              onPress={() => setActivo((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}
            >
              <View style={{ flex: 1 }}>
                <Text variante="cuerpo">Activo</Text>
                <Text variante="caption" tono="muted">
                  Un pack inactivo no se puede vender.
                </Text>
              </View>
              <Ionicons name={activo ? "toggle" : "toggle-outline"} size={34} color={activo ? t.colores.brand : t.colores.muted} />
            </Pressable>
          ) : null}

          <Button titulo={editando ? "Guardar" : "Crear pack"} tamano="lg" onPress={guardar} cargando={guardando} />
        </ScrollView>
      </View>
    </Modal>
  );
}
