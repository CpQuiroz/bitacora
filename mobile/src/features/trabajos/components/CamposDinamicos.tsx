import { View } from "react-native";
import type { CampoTipoTrabajo } from "@bitacora/shared";
import { useTema } from "../../../theme";
import { Button, Input, Text } from "../../../components/ui";

export function CamposDinamicos({
  nombre,
  campos,
  valores,
  onCambiar,
  onGuardar,
  guardando,
  editable,
}: {
  nombre: string;
  campos: CampoTipoTrabajo[];
  valores: Record<string, string>;
  onCambiar: (clave: string, valor: string) => void;
  onGuardar: () => void;
  guardando: boolean;
  editable: boolean;
}) {
  const t = useTema();
  if (campos.length === 0) return null;

  return (
    <View style={{ gap: t.espacio(3) }}>
      <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
        {nombre}
      </Text>
      {campos.map((campo) => (
        <Input
          key={campo.clave}
          etiqueta={campo.etiqueta}
          editable={editable}
          value={valores[campo.clave] ?? ""}
          onChangeText={(v) => onCambiar(campo.clave, v)}
          keyboardType={campo.tipo === "numero" ? "numeric" : "default"}
        />
      ))}
      {editable && <Button titulo={guardando ? "Guardando…" : "Guardar formulario"} onPress={onGuardar} cargando={guardando} />}
    </View>
  );
}
