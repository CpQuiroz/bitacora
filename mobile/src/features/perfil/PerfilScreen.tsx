import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { Button, Card, Screen, Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";
import { biometriaActivada, biometriaDisponible, nombreBiometria, pedirBiometria, setBiometriaActivada } from "../../lib/biometria";

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
  const { enLinea, pendientes, fallidas, sincronizarAhora, reintentar, descartar } = useRed();

  const [bioDisponible, setBioDisponible] = useState(false);
  const [bioNombre, setBioNombre] = useState("biometría");
  const [bioActiva, setBioActiva] = useState(false);

  useEffect(() => {
    biometriaDisponible().then(setBioDisponible);
    nombreBiometria().then(setBioNombre);
    biometriaActivada().then(setBioActiva);
  }, []);

  async function alternarBiometria() {
    if (bioActiva) {
      await setBiometriaActivada(false);
      setBioActiva(false);
      return;
    }
    const ok = await pedirBiometria(`Confirma con ${bioNombre} para activar el bloqueo`);
    if (!ok) {
      Alert.alert("No se pudo activar", "No se verificó tu identidad.");
      return;
    }
    await setBiometriaActivada(true);
    setBioActiva(true);
  }

  if (auth.fase !== "listo" && auth.fase !== "mfa-requerido") return null;
  const u = auth.usuario;
  const tituloBio = bioNombre === "Face ID" ? "Bloquear con Face ID" : "Bloquear con huella";

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
        <Fila
          etiqueta="Sin sincronizar"
          valor={pendientes.length === 0 ? "Nada pendiente" : `${pendientes.length} acción(es)`}
        />
        {pendientes.length > 0 && (
          <Button
            titulo="Sincronizar ahora"
            variante="secundario"
            onPress={sincronizarAhora}
            style={{ marginTop: t.espacio(3) }}
          />
        )}
      </Card>

      {fallidas.length > 0 && (
        <Card style={{ borderColor: t.colores.danger, backgroundColor: t.colores.dangerSoft }} plano>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2), marginBottom: t.espacio(3) }}>
            <Ionicons name="alert-circle-outline" size={18} color={t.colores.danger} />
            <Text variante="etiqueta" weight="semibold" style={{ color: t.colores.danger }}>
              No se pudieron enviar
            </Text>
          </View>
          <Text variante="caption" tono="muted" style={{ marginBottom: t.espacio(3) }}>
            Estas acciones fallaron varias veces. Reinténtalas o, si ya no aplican, descártalas.
          </Text>
          {fallidas.map((a) => (
            <View
              key={a.id}
              style={{
                borderTopWidth: 1,
                borderTopColor: t.colores.border,
                paddingVertical: t.espacio(3),
                gap: t.espacio(2),
              }}
            >
              <Text variante="etiqueta" weight="semibold">
                {a.etiqueta}
              </Text>
              {a.ultimoError ? (
                <Text variante="caption" tono="danger">
                  {a.ultimoError}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
                <Button titulo="Reintentar" variante="secundario" tamano="md" onPress={() => reintentar(a.id)} />
                <Button titulo="Descartar" variante="ghost" onPress={() => descartar(a.id)} />
              </View>
            </View>
          ))}
        </Card>
      )}

      {bioDisponible && (
        <Card>
          <Pressable
            onPress={alternarBiometria}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: t.espacio(3),
              minHeight: 44,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variante="etiqueta" weight="medium">
                {tituloBio}
              </Text>
              <Text variante="caption" tono="muted">
                Pide tu {bioNombre} al abrir la app.
              </Text>
            </View>
            <Ionicons
              name={bioActiva ? "toggle" : "toggle-outline"}
              size={34}
              color={bioActiva ? t.colores.brand : t.colores.muted}
            />
          </Pressable>
        </Card>
      )}

      <Text variante="caption" tono="muted" style={{ textAlign: "center" }}>
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
