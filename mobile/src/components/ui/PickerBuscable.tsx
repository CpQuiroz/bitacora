import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { Text } from "./Text";
import { Input } from "./Input";

type Opcion = { id: string; label: string; sublabel?: string };

/**
 * Selector con búsqueda en un modal a pantalla completa. Reemplaza la
 * pared de "pastillas" cuando la lista puede ser larga (clientes,
 * equipos). Target táctil grande por fila.
 */
export function PickerBuscable({
  etiqueta,
  placeholder = "Seleccionar",
  valor,
  opciones,
  onElegir,
  opcionVacia,
}: {
  etiqueta: string;
  placeholder?: string;
  valor: string;
  opciones: Opcion[];
  onElegir: (id: string) => void;
  opcionVacia?: string; // ej. "Sin vehículo" → id ""
}) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");

  const seleccionada = valor === "" ? undefined : opciones.find((o) => o.id === valor);
  const textoBoton = seleccionada?.label ?? (valor === "" && opcionVacia ? opcionVacia : placeholder);

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term ? opciones.filter((o) => o.label.toLowerCase().includes(term) || o.sublabel?.toLowerCase().includes(term)) : opciones;
    return opcionVacia ? [{ id: "", label: opcionVacia }, ...base] : base;
  }, [q, opciones, opcionVacia]);

  return (
    <View style={{ gap: t.espacio(1.5) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <Pressable
        onPress={() => {
          setQ("");
          setAbierto(true);
        }}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: t.colores.border,
          borderRadius: t.radio.md,
          paddingHorizontal: t.espacio(3.5),
          minHeight: 48,
          justifyContent: "center",
          backgroundColor: t.colores.surface,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.espacio(2) }}>
          <Text variante="cuerpo" tono={seleccionada || (valor === "" && opcionVacia) ? "normal" : "faint"} numberOfLines={1} style={{ flex: 1 }}>
            {textoBoton}
          </Text>
          <Ionicons name="chevron-down" size={18} color={t.colores.muted} />
        </View>
      </Pressable>

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
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
            <Pressable onPress={() => setAbierto(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={t.colores.foreground} />
            </Pressable>
            <Text variante="subtitulo" style={{ flex: 1 }}>
              {etiqueta}
            </Text>
          </View>
          <View style={{ padding: t.espacio(4) }}>
            <Input placeholder="Buscar…" value={q} onChangeText={setQ} autoFocus autoCorrect={false} />
          </View>
          <FlatList
            data={filtradas}
            keyExtractor={(o) => o.id || "__vacia__"}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const activo = item.id === valor;
              return (
                <Pressable
                  onPress={() => {
                    onElegir(item.id);
                    setAbierto(false);
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: t.espacio(4),
                    paddingVertical: t.espacio(3.5),
                    minHeight: 52,
                    justifyContent: "center",
                    backgroundColor: pressed ? t.colores.surfaceAlt : "transparent",
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text variante="cuerpo" weight={activo ? "semibold" : "regular"} tono={activo ? "brand" : "normal"}>
                        {item.label}
                      </Text>
                      {item.sublabel ? (
                        <Text variante="caption" tono="muted">
                          {item.sublabel}
                        </Text>
                      ) : null}
                    </View>
                    {activo ? <Ionicons name="checkmark" size={20} color={t.colores.brand} /> : null}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text variante="cuerpo" tono="muted" style={{ textAlign: "center", padding: t.espacio(6) }}>
                Sin resultados.
              </Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}
