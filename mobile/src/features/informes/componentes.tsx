import { type ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Card, Texto } from "@bitacora/ui/native";

// Sistema visual móvil v2 (14-sep-2026) — bloques compartidos de todas
// las secciones de Informes (Ventas/Financiero/Operaciones/Servicios/
// Clientes/Gastos, en ./secciones/*.tsx). `CargandoSeccion`/`ErrorSeccion`
// se eliminaron: los call-sites usan directamente `LoadingState`/
// `ErrorState` de @bitacora/ui/native (equivalentes exactos, sin
// necesidad de un wrapper local).

/** Tarjeta de KPI — mismo dato que el <Stat> de la web, en layout de grilla 2 columnas. */
export function Metrica({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <View style={{ width: "48%", borderWidth: 1, borderColor: tokens.color.divider, borderRadius: tokens.radius.md, padding: tokens.space["3"], gap: 2 }}>
      <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} numberOfLines={1}>
        {etiqueta}
      </Texto>
      <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }} numberOfLines={1}>
        {valor}
      </Texto>
      {nota ? (
        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} numberOfLines={1}>
          {nota}
        </Texto>
      ) : null}
    </View>
  );
}

/** Grilla de Metrica — envuelve en filas de 2. */
export function GrillaMetricas({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>{children}</View>;
}

/** Sección con título — envoltorio consistente para cada bloque del informe. */
export function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card>
      <View style={{ gap: tokens.space["2"] }}>
        <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text}>
          {titulo}
        </Texto>
        {children}
      </View>
    </Card>
  );
}

/** Fila de una tabla simple: etiqueta a la izquierda, 1-2 valores a la derecha. */
export function FilaTabla({ label, sub, valor, valorSecundario }: { label: string; sub?: string; valor: string; valorSecundario?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: tokens.space["3"],
        paddingVertical: tokens.space["2"],
        borderBottomWidth: 1,
        borderBottomColor: tokens.color.divider,
      }}
    >
      <View style={{ flex: 1 }}>
        <Texto tamano={tokens.size.small} color={tokens.color.text} numberOfLines={1}>
          {label}
        </Texto>
        {sub ? (
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} numberOfLines={1}>
            {sub}
          </Texto>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
          {valor}
        </Texto>
        {valorSecundario ? (
          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
            {valorSecundario}
          </Texto>
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
    <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
      {mensaje}
    </Texto>
  );
}
