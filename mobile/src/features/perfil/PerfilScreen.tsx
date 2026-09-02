import Constants from "expo-constants";
import { View } from "react-native";
import { useTema } from "../../theme";
import { Button, Card, Screen, Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";

const ETIQUETA_ROL: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  contador: "Contador",
  colaborador: "Colaborador",
};
const ETIQUETA_FUNCION: Record<string, string> = {
  tecnico: "Técnico",
  chofer: "Chofer",
  instalador: "Instalador",
  administrativo: "Administrativo",
  otro: "Otro",
};

export function PerfilScreen() {
  const t = useTema();
  const auth = useAuth();
  const { enLinea, cola, sincronizarAhora } = useRed();
  if (auth.fase !== "listo" && auth.fase !== "mfa-requerido") return null;
  const u = auth.usuario;

  return (
    <Screen scroll style={{ gap: t.espacio(4) }}>
      <View style={{ gap: t.espacio(1) }}>
        <Text variante="titulo">{u.nombre}</Text>
        <Text variante="etiqueta" tono="muted">
          {u.empresa.nombre}
        </Text>
      </View>

      <Card>
        <Fila etiqueta="Rol" valor={ETIQUETA_ROL[u.rol] ?? u.rol} />
        {u.funcion ? <Fila etiqueta="Función" valor={ETIQUETA_FUNCION[u.funcion] ?? u.funcion} /> : null}
        {u.telefono ? <Fila etiqueta="Teléfono" valor={u.telefono} /> : null}
        {u.zona ? <Fila etiqueta="Zona" valor={u.zona} /> : null}
      </Card>

      <Card>
        <Fila etiqueta="Conexión" valor={enLinea ? "En línea" : "Sin conexión"} />
        <Fila etiqueta="Sin sincronizar" valor={cola.length === 0 ? "Nada pendiente" : `${cola.length} acción(es)`} />
        {cola.length > 0 ? <Button titulo="Sincronizar ahora" variante="secundario" onPress={sincronizarAhora} style={{ marginTop: t.espacio(3) }} /> : null}
      </Card>

      <Text variante="caption" tono="faint" style={{ textAlign: "center" }}>
        Bitácora {Constants.expoConfig?.version ?? ""}
      </Text>

      <Button titulo="Cerrar sesión" variante="peligro" onPress={auth.cerrarSesion} />
    </Screen>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: t.espacio(1.5) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <Text variante="etiqueta" weight="medium">
        {valor}
      </Text>
    </View>
  );
}
