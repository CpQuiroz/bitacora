import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { Cliente } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Button, Card, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { useRed } from "../../services/sync/NetworkProvider";
import { editarCliente, obtenerCliente } from "../../services/clientes";
import type { GestionStackParamList } from "../../shell/navigation/types";

const soloDigitos = (s: string) => s.replace(/[^\d]/g, "");

export function ClienteDetalleScreen({ route, navigation }: NativeStackScreenProps<GestionStackParamList, "ClienteDetalle">) {
  const t = useTema();
  const { clienteId } = route.params;
  const { enLinea } = useRed();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setCliente(await obtenerCliente(clienteId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el cliente");
    }
  }, [clienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function alternarActivo() {
    if (!cliente) return;
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para esto.");
    setOcupado(true);
    const r = await editarCliente(clienteId, {
      nombre: cliente.nombre,
      rut: cliente.rut ?? "",
      direccion: cliente.direccion,
      comuna: cliente.comuna ?? "",
      telefono: cliente.telefono ?? "",
      correo: cliente.correo ?? "",
      notas: cliente.notas ?? "",
      activo: !cliente.activo,
    });
    setOcupado(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
    cargar();
  }

  if (!cliente && !error) return <LoadingScreen />;
  if (error && !cliente) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!cliente) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(16) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
        <Text variante="titulo" style={{ flex: 1 }}>
          {cliente.nombre}
        </Text>
        {!cliente.activo ? <Badge texto="inactivo" estado="cancelado" /> : null}
      </View>

      <Card plano style={{ gap: t.espacio(2) }}>
        {cliente.rut ? <Fila etiqueta="RUT" valor={cliente.rut} /> : null}
        <Fila etiqueta="Dirección" valor={cliente.direccion} />
        {cliente.comuna ? <Fila etiqueta="Comuna" valor={cliente.comuna} /> : null}
        {cliente.telefono ? <Fila etiqueta="Teléfono" valor={cliente.telefono} /> : null}
        {cliente.correo ? <Fila etiqueta="Correo" valor={cliente.correo} /> : null}
      </Card>

      {cliente.notas ? (
        <Card plano style={{ gap: t.espacio(1.5) }}>
          <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
            Notas
          </Text>
          <Text variante="cuerpo">{cliente.notas}</Text>
        </Card>
      ) : null}

      {cliente.telefono || cliente.correo ? (
        <View style={{ flexDirection: "row", gap: t.espacio(2.5), flexWrap: "wrap" }}>
          {cliente.telefono ? (
            <Button
              titulo="Llamar"
              variante="secundario"
              icono={<Ionicons name="call-outline" size={16} color={t.colores.foreground} />}
              onPress={() => Linking.openURL(`tel:${cliente.telefono}`)}
            />
          ) : null}
          {cliente.telefono ? (
            <Button
              titulo="WhatsApp"
              variante="secundario"
              icono={<Ionicons name="logo-whatsapp" size={16} color={t.colores.foreground} />}
              onPress={() => Linking.openURL(`https://wa.me/${soloDigitos(cliente.telefono!)}`)}
            />
          ) : null}
          {cliente.correo ? (
            <Button
              titulo="Correo"
              variante="secundario"
              icono={<Ionicons name="mail-outline" size={16} color={t.colores.foreground} />}
              onPress={() => Linking.openURL(`mailto:${cliente.correo}`)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: t.espacio(2.5), marginTop: t.espacio(1), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(4) }}>
        <Button
          titulo="Editar"
          variante="secundario"
          icono={<Ionicons name="create-outline" size={16} color={t.colores.foreground} />}
          onPress={() => navigation.navigate("ClienteForm", { clienteId })}
        />
        <Button
          titulo={cliente.activo ? "Marcar como inactivo" : "Reactivar cliente"}
          variante={cliente.activo ? "peligro" : "primario"}
          onPress={alternarActivo}
          cargando={ocupado}
        />
      </View>
    </ScrollView>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <Text variante="etiqueta" weight="medium" style={{ flexShrink: 1, textAlign: "right" }}>
        {valor}
      </Text>
    </View>
  );
}
