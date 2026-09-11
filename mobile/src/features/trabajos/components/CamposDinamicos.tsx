import { View } from "react-native";
import type { CampoTipoTrabajo } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, Texto } from "@bitacora/ui/native";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
  if (campos.length === 0) return null;

  return (
    <View style={{ gap: tokens.space["3"] }}>
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
        {nombre}
      </Texto>
      {campos.map((campo) => (
        <Input
          key={campo.clave}
          etiqueta={campo.etiqueta}
          deshabilitado={!editable}
          valor={valores[campo.clave] ?? ""}
          onCambio={(v) => onCambiar(campo.clave, v)}
          tipo={campo.tipo === "numero" ? "numero" : "texto"}
        />
      ))}
      {editable ? (
        <Button bloque onPress={onGuardar} cargando={guardando}>
          Guardar formulario
        </Button>
      ) : null}
    </View>
  );
}
