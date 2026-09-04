import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useTema } from "../../theme";
import { Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import { PERIODOS, resolverPeriodo, type PeriodoValor } from "../../lib/periodo";
import { VisionGeneral } from "./secciones/VisionGeneral";
import { Financiero } from "./secciones/Financiero";
import { Ventas } from "./secciones/Ventas";
import { Operaciones } from "./secciones/Operaciones";
import { Servicios } from "./secciones/Servicios";
import { ClientesInforme } from "./secciones/ClientesInforme";
import { GastosInformeSeccion } from "./secciones/GastosInformeSeccion";

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

function Chips<T extends string>({ opciones, valor, onElegir }: { opciones: { valor: T; etiqueta: string }[]; valor: T; onElegir: (v: T) => void }) {
  const t = useTema();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.espacio(2), paddingHorizontal: t.espacio(4) }}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onElegir(o.valor)}
            style={{
              minHeight: 36,
              justifyContent: "center",
              paddingHorizontal: t.espacio(3.5),
              borderRadius: t.radio.md,
              backgroundColor: activo ? t.colores.brand : t.colores.surfaceAlt,
            }}
          >
            <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
              {o.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function InformesScreen() {
  const t = useTema();
  const auth = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoValor>("este_mes");
  const [seccion, setSeccion] = useState<Seccion>("vision-general");

  const { desde, hasta } = useMemo(() => resolverPeriodo(periodo), [periodo]);
  const moneda = auth.fase === "listo" ? auth.usuario.empresa.moneda : "CLP";
  const periodoActual = PERIODOS.find((p) => p.valor === periodo);

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <View style={{ paddingTop: t.espacio(4), gap: t.espacio(3) }}>
        <Chips opciones={PERIODOS} valor={periodo} onElegir={setPeriodo} />
        <Chips opciones={SECCIONES} valor={seccion} onElegir={setSeccion} />
      </View>

      <ScrollView contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(4), paddingBottom: t.espacio(10) }}>
        <Text variante="caption" tono="muted">
          {periodoActual?.etiqueta} · {desde} a {hasta}
        </Text>

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
