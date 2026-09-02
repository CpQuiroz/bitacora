import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTema } from "../../theme";
import { Text } from "./Text";
import { Button } from "./Button";

const wrap = { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: 12, padding: 32 };

export function LoadingScreen({ mensaje }: { mensaje?: string }) {
  const t = useTema();
  return (
    <View style={[wrap, { backgroundColor: t.colores.bg }]}>
      <ActivityIndicator color={t.colores.brand} />
      {mensaje ? (
        <Text variante="etiqueta" tono="muted">
          {mensaje}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <View style={wrap}>
      <Text variante="subtitulo" style={{ textAlign: "center" }}>
        Algo salió mal
      </Text>
      <Text variante="cuerpo" tono="muted" style={{ textAlign: "center" }}>
        {mensaje}
      </Text>
      {onReintentar ? <Button titulo="Reintentar" variante="secundario" fullWidth={false} onPress={onReintentar} /> : null}
    </View>
  );
}

export function EmptyState({ icono, titulo, mensaje, accion }: { icono?: ReactNode; titulo: string; mensaje?: string; accion?: ReactNode }) {
  return (
    <View style={wrap}>
      {icono}
      <Text variante="subtitulo" style={{ textAlign: "center" }}>
        {titulo}
      </Text>
      {mensaje ? (
        <Text variante="cuerpo" tono="muted" style={{ textAlign: "center" }}>
          {mensaje}
        </Text>
      ) : null}
      {accion}
    </View>
  );
}
