import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { ScreenHeader, Texto, useMarca } from "@bitacora/ui/native";
import { useAuth } from "../auth/AuthContext";
import { PERIODOS, resolverPeriodo, type PeriodoValor } from "../../lib/periodo";
import { VisionGeneral } from "./secciones/VisionGeneral";
import { Financiero } from "./secciones/Financiero";
import { Ventas } from "./secciones/Ventas";
import { Operaciones } from "./secciones/Operaciones";
import { Servicios } from "./secciones/Servicios";
import { ClientesInforme } from "./secciones/ClientesInforme";
import { GastosInformeSeccion } from "./secciones/GastosInformeSeccion";
import type { MasStackParamList } from "../../shell/navigation/types";

type Seccion = "vision-general" | "financiero" | "ventas" | "operaciones" | "servicios" | "clientes" | "gastos";

const SECCIONES: { valor: Seccion; etiqueta: string }[] = [
  { valor: "vision-general", etiqueta: "Visión general" },
  { valor: "financiero", etiqueta: "Financiero" },
  { valor: "ventas", etiqueta: "Ventas" },
  { valor: "operaciones", etiqueta: "Operaciones" },
  { valor: "servicios", etiqueta: "Servicios" },
  { valor: "clientes", etiqueta: "Clientes" },
  { valor: "gastos", etiqueta: "Gastos" },
];

// Chips del selector de período — mismo aspecto visual que la fila de
// `filtros` de ScreenHeader (pill, marca.base cuando está activo), pero
// dibujados aparte: ScreenHeader solo admite UNA fila de chips y esa la
// ocupa el selector de sección (Ventas/Financiero/etc).
function ChipsPeriodo<T extends string>({ opciones, valor, onElegir }: { opciones: { valor: T; etiqueta: string }[]; valor: T; onElegir: (v: T) => void }) {
  const marca = useMarca();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space["2"], paddingHorizontal: tokens.space["4"] }}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onElegir(o.valor)}
            style={{
              minHeight: 36,
              justifyContent: "center",
              paddingHorizontal: tokens.space["3"],
              borderRadius: tokens.radius.pill,
              backgroundColor: activo ? marca.suave : tokens.color.surface,
            }}
          >
            <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : tokens.color.text}>
              {o.etiqueta}
            </Texto>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Sistema visual móvil v2 — shell migrado: ScreenHeader (con `accion`
// de volver, esta pantalla es push desde "Más") + la fila de chips de
// sección pasa a ser el `filtros` del propio ScreenHeader. El selector
// de período queda como una fila de chips propia debajo, mismo patrón
// que la navegación de período de AgendaScreen. Las secciones
// (Ventas/Financiero/etc, en ./secciones/*) y sus bloques compartidos
// (./componentes.tsx) también migradas (14-sep-2026).
export function InformesScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "Informes">) {
  const auth = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoValor>("este_mes");
  const [seccion, setSeccion] = useState<Seccion>("vision-general");

  const { desde, hasta } = useMemo(() => resolverPeriodo(periodo), [periodo]);
  const moneda = auth.fase === "listo" ? auth.usuario.empresa.moneda : "CLP";
  const periodoActual = PERIODOS.find((p) => p.valor === periodo);

  const filtrosSeccion = {
    opciones: SECCIONES,
    valor: seccion,
    onCambio: (v: string) => setSeccion(v as Seccion),
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        titulo="Informes"
        accion={{ icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" }}
        filtros={filtrosSeccion}
      />

      <View style={{ paddingTop: tokens.space["3"] }}>
        <ChipsPeriodo opciones={PERIODOS} valor={periodo} onElegir={setPeriodo} />
      </View>

      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 2 }}>
        <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
          {periodoActual?.etiqueta} · {desde} a {hasta}
        </Texto>

        {seccion === "vision-general" && <VisionGeneral desde={desde} hasta={hasta} moneda={moneda} />}
        {seccion === "financiero" && <Financiero desde={desde} hasta={hasta} moneda={moneda} />}
        {seccion === "ventas" && <Ventas desde={desde} hasta={hasta} moneda={moneda} />}
        {seccion === "operaciones" && <Operaciones desde={desde} hasta={hasta} />}
        {seccion === "servicios" && <Servicios desde={desde} hasta={hasta} />}
        {seccion === "clientes" && <ClientesInforme desde={desde} hasta={hasta} moneda={moneda} />}
        {seccion === "gastos" && <GastosInformeSeccion desde={desde} hasta={hasta} moneda={moneda} />}
      </ScrollView>
    </View>
  );
}
