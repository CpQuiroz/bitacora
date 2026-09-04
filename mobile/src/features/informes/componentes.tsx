import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTema } from "../../theme";
import { Button, Card, Text } from "../../components/ui";

/** Spinner centrado para el contenido de una pestaña — LoadingScreen es
 * a pantalla completa (flex:1), acá el padre ya tiene sus propios chips
 * arriba, así que solo el bloque de abajo debe mostrar "cargando". */
export function CargandoSeccion() {
  const t = useTema();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: t.espacio(12) }}>
      <ActivityIndicator color={t.colores.brand} />
    </View>
  );
}

export function ErrorSeccion({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  const t = useTema();
  return (
    <View style={{ alignItems: "center", gap: t.espacio(3), paddingVertical: t.espacio(8) }}>
      <Text variante="cuerpo" tono="muted" style={{ textAlign: "center" }}>
        {mensaje}
      </Text>
      <Button titulo="Reintentar" variante="secundario" fullWidth={false} onPress={onReintentar} />
    </View>
  );
}

/** Tarjeta de KPI — mismo dato que el <Stat> de la web, en layout de grilla 2 columnas. */
export function Metrica({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  const t = useTema();
  return (
    <View style={{ width: "48%", borderWidth: 1, borderColor: t.colores.border, borderRadius: t.radio.md, padding: t.espacio(3), gap: 2 }}>
      <Text variante="caption" tono="muted" numberOfLines={1}>
        {etiqueta}
      </Text>
      <Text variante="subtitulo" weight="semibold" style={{ fontVariant: ["tabular-nums"] }} numberOfLines={1}>
        {valor}
      </Text>
      {nota ? (
        <Text variante="caption" tono="muted" numberOfLines={1}>
          {nota}
        </Text>
      ) : null}
    </View>
  );
}

/** Grilla de Metrica — envuelve en filas de 2. */
export function GrillaMetricas({ children }: { children: ReactNode }) {
  const t = useTema();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2.5) }}>{children}</View>;
}

/** Sección con título — envoltorio consistente para cada bloque del informe. */
export function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  const t = useTema();
  return (
    <Card plano style={{ gap: t.espacio(2.5) }}>
      <Text variante="etiqueta" weight="semibold">
        {titulo}
      </Text>
      {children}
    </Card>
  );
}

/** Fila de una tabla simple: etiqueta a la izquierda, 1-2 valores a la derecha. */
export function FilaTabla({ label, sub, valor, valorSecundario }: { label: string; sub?: string; valor: string; valorSecundario?: string }) {
  const t = useTema();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: t.espacio(3),
        paddingVertical: t.espacio(2),
        borderBottomWidth: 1,
        borderBottomColor: t.colores.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variante="etiqueta" numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text variante="caption" tono="muted" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text variante="etiqueta" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
          {valor}
        </Text>
        {valorSecundario ? (
          <Text variante="caption" tono="muted" style={{ fontVariant: ["tabular-nums"] }}>
            {valorSecundario}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Fetch de una sección de Informes: recarga cuando cambian las deps
 * (típicamente [desde, hasta] o [desde, hasta, agrupacion]) y expone un
 * reintentar() para el estado de error. */
export function useInformeFetch<T>(fetcher: () => Promise<T>, deps: unknown[]): { datos: T | null; error: string | null; reintentar: () => void } {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setDatos(null);
    setError(null);
    fetcher()
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : "No se pudo cargar el informe");
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intento]);

  return { datos, error, reintentar: () => setIntento((i) => i + 1) };
}

export function SinDatos({ mensaje }: { mensaje: string }) {
  return (
    <Text variante="caption" tono="muted">
      {mensaje}
    </Text>
  );
}
