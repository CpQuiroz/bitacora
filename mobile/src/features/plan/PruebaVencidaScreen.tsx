import { View } from "react-native";
import { CalendarX } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { Button, Texto, useMarca } from "@bitacora/ui/native";
import { PantallaAuth } from "../auth/PantallaAuth";
import { useAuth } from "../auth/AuthContext";
import type { PruebaVencidaStackParamList } from "../../shell/navigation/types";

// Tarea 144: prueba vencida sin plan pago. La app queda bloqueada salvo
// Mi plan (solo lectura), Mi cuenta y cerrar sesión. Sin botón para pagar:
// por Google Play, el plan se elige en la web (ver services/plan.ts).
export function PruebaVencidaScreen({ navigation }: NativeStackScreenProps<PruebaVencidaStackParamList, "PruebaVencida">) {
  const auth = useAuth();
  const marca = useMarca();
  const esAdmin = auth.fase === "prueba-vencida" && auth.usuario.rol === "admin";

  return (
    <PantallaAuth>
      <View style={{ alignItems: "center", gap: tokens.space["3"] }}>
        <CalendarX size={48} strokeWidth={2.75} color={marca.base} />
        <Texto tamano={tokens.size.h5} color={tokens.color.text} style={{ textAlign: "center" }}>
          Tu período de prueba terminó
        </Texto>
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`} style={{ textAlign: "center" }}>
          {esAdmin
            ? "Para seguir usando Bitácora, elige un plan desde la web (Configuración → Plan). Tus datos están guardados."
            : "Pídele a quien administra Bitácora en tu empresa que elija un plan. Tus datos están guardados."}
        </Texto>
      </View>
      <Button bloque onPress={auth.refrescar}>
        Ya elegimos un plan
      </Button>
      {esAdmin ? (
        <Button variante="secundario" bloque onPress={() => navigation.navigate("MiPlan")}>
          Ver mi plan
        </Button>
      ) : null}
      <Button variante="secundario" bloque onPress={() => navigation.navigate("Perfil")}>
        Mi cuenta
      </Button>
      <Button variante="ghost" bloque onPress={auth.cerrarSesion}>
        Cerrar sesión
      </Button>
    </PantallaAuth>
  );
}
