import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto } from "./Texto";
import { useMarca } from "./marca";

// Extraído (20-sep-2026) de 2 copias casi idénticas (Nuevo gasto, Nuevo
// trabajo) que arrancaban la tira 7 días antes de hoy — al abrir el
// formulario lo que se veía de entrada eran días pasados, "hoy" quedaba
// fuera de pantalla sin marca alguna más allá de estar seleccionado.
// Este componente: (a) al montar, deja "hoy" al principio del área
// visible en vez de que haya que descubrir que hay que deslizar, y (b)
// marca "HOY" siempre, esté o no elegido — para que un día pasado/futuro
// se pueda distinguir de hoy incluso después de navegar la tira.
//
// `diasAtras` controla si además de hoy hacia adelante se ofrecen días
// pasados para elegir (Gasto/Trabajo: sí, para poder registrar algo con
// fecha atrasada; Nueva cita/reserva de cosmetología: no tiene sentido
// agendar en el pasado, así que quedan con diasAtras=0 — la tira
// simplemente empieza en hoy, sin nada que buscar).
const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ANCHO_CHIP = 56;
const GAP_CHIP = tokens.space["2"];

export type PropsSelectorDias = {
  valor: string; // "YYYY-MM-DD"
  onElegir: (k: string) => void;
  /** Cuántos días mostrar en total (por defecto 45). */
  cantidadDias?: number;
  /** Cuántos días antes de hoy incluir de entrada (por defecto 7; 0 = arranca en hoy). */
  diasAtras?: number;
};

export function SelectorDias({ valor, onElegir, cantidadDias = 45, diasAtras = 7 }: PropsSelectorDias) {
  const marca = useMarca();
  const scrollRef = useRef<ScrollView>(null);
  const hoyKey = useMemo(() => clave(new Date()), []);

  const dias = useMemo(() => {
    const hoy = new Date();
    const base =
      valor < hoyKey ? new Date(valor + "T00:00:00") : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diasAtras);
    return Array.from({ length: cantidadDias }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [valor, hoyKey, cantidadDias, diasAtras]);

  useEffect(() => {
    // Si se está editando algo con fecha pasada, la tira ya arranca ahí
    // (ver `dias` arriba) — no forzar el scroll a hoy, tapearía la fecha
    // real que se está editando.
    if (valor < hoyKey) return;
    const indice = dias.findIndex((d) => clave(d) === hoyKey);
    if (indice <= 0) return;
    const x = indice * (ANCHO_CHIP + GAP_CHIP);
    // Sin animar: es la posición inicial, no una acción del usuario.
    const id = requestAnimationFrame(() => scrollRef.current?.scrollTo({ x, animated: false }));
    return () => cancelAnimationFrame(id);
    // Solo al montar — si el usuario navega la tira después, no queremos
    // "devolverlo" a hoy de nuevo en cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GAP_CHIP, paddingTop: 9 }}>
      {dias.map((d) => {
        const k = clave(d);
        const activo = k === valor;
        const esHoy = k === hoyKey;
        return (
          <View key={k} style={{ width: ANCHO_CHIP }}>
            {esHoy ? (
              <View style={{ position: "absolute", top: -9, left: 0, right: 0, alignItems: "center", zIndex: 1 }}>
                <View style={{ backgroundColor: tokens.color.accent2Ramp["100"], borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Texto tamano={9} peso="semibold" color={tokens.color.accent2Ramp["800"]} style={{ letterSpacing: 0.5 }}>
                    HOY
                  </Texto>
                </View>
              </View>
            ) : null}
            <Pressable
              onPress={() => onElegir(k)}
              style={{
                width: ANCHO_CHIP,
                minHeight: 60,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: tokens.radius.md,
                paddingHorizontal: tokens.space["2"],
                backgroundColor: activo ? marca.suave : tokens.color.surface,
                borderWidth: esHoy && !activo ? 1.5 : 1,
                borderStyle: esHoy && !activo ? "dashed" : "solid",
                borderColor: activo ? marca.base : esHoy ? tokens.color.accent2 : tokens.color.divider,
              }}
            >
              <Texto tamano={tokens.size.caption} color={activo ? marca.fuerte : tokens.color.textSecondary}>
                {DIAS_SEMANA[d.getDay()]}
              </Texto>
              <Texto
                tamano={tokens.size.h5}
                peso="semibold"
                color={activo ? marca.fuerte : tokens.color.text}
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {d.getDate()}
              </Texto>
              <Texto tamano={tokens.size.caption} color={activo ? marca.fuerte : tokens.color.textSecondary}>
                {MESES[d.getMonth()]}
              </Texto>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
